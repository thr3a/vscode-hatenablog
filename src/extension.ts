import * as vscode from 'vscode';
import { createHatenaClient } from '#lib/client';
import { notifyGoogleIndexingIfConfigured, publishUrlToGoogleIndexingApi } from '#lib/google-indexing';
import { postMarkdownDocument } from '#lib/post';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('hatenablog.post', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Markdownファイルを開いてください');
      return;
    }

    const config = vscode.workspace.getConfiguration('hatenablog');
    const result = await postMarkdownDocument(
      {
        languageId: editor.document.languageId,
        fullText: editor.document.getText(),
        config: {
          hatenaId: config.get<string>('hatenaId', ''),
          blogId: config.get<string>('blogId', ''),
          apiKey: config.get<string>('apiKey', '')
        }
      },
      {
        client: createHatenaClient(fetch),
        now: () => new Date()
      }
    );

    if (result.status === 'cancelled') {
      return;
    }

    if (result.status === 'error') {
      vscode.window.showErrorMessage(result.message);
      return;
    }

    try {
      const fullRange = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length)
      );

      await editor.edit((editBuilder) => {
        editBuilder.replace(fullRange, result.newContent);
      });
      await editor.document.save();
      await notifyGoogleIndexingIfConfigured(
        {
          credentialsPath: config.get<string>('google_credentials_path', ''),
          url: result.url
        },
        {
          publishUrl: publishUrlToGoogleIndexingApi,
          logError: (_message: string, error: unknown) => {
            const msg = error instanceof Error ? error.message : String(error);
            vscode.window.showWarningMessage(`Google Indexing API への送信に失敗しました: ${msg}`);
          }
        }
      );

      vscode.window.showInformationMessage(`はてなブログに${result.action}しました: ${result.title}`);
      await openEntryUrl(result.url);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`投稿に失敗しました: ${message}`);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}

async function openEntryUrl(url: string): Promise<void> {
  if (process.platform !== 'darwin' || !url) {
    return;
  }

  await vscode.env.openExternal(vscode.Uri.parse(url));
}

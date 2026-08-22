import { Context } from 'grammy';

export async function handleHelp(ctx: Context) {
  const username = ctx.me?.username || 'flowtaskmanager_bot';
  const escapedUsername = username.replace(/[_*[\]()~`>#+-=|{}.!]/g, '\\$&');

  const helpText = `*FlowTask Commands:*

/start \\- Initialize FlowTask & Open Mini App
/task \\<title\\> \\- Quickly create a new task
/tasks \\- View your active tasks
/today \\- View tasks due today
/help \\- Show this commands guide

💡 *Tip:* You can also add @${escapedUsername} to your team groups to manage group tasks collaboratively\\!`;

  await ctx.reply(helpText, { parse_mode: 'MarkdownV2' });
}

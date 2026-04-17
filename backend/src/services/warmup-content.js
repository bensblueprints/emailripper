// Human-looking content generator for peer warmup messages.
// Short, varied, innocuous — nothing resembling a marketing pitch.

const SUBJECTS = [
  'Quick thought', 'Following up', 'Morning!', 'Re: our chat', 'One more thing',
  'Checking in', 'Nice to meet you', 'Thanks again', 'Idea for you', 'Update',
  'Tomorrow?', 'Just catching up', 'How did it go?', 'Circle back', 'Proposal notes',
  'Coffee soon?', 'Draft for review', 'Thought you should see this', 'Small update',
  'Plan looks good', 'Got it', 'Let me know', 'Agenda', 'Notes from today',
  'About the doc', 'My two cents', 'Next steps', 'Any thoughts?', 'Short reply',
];

const OPENERS = [
  'Hey — hope your week is going well.',
  'Hi! Quick one for you.',
  'Hope you are doing great.',
  'Just a quick note.',
  'Thanks for the note earlier.',
  'Appreciate your time the other day.',
  'Good to hear from you last week.',
  'Following up on our earlier chat.',
];

const BODIES = [
  'Read through your notes last night and most of it tracks with what we discussed. One small clarification on point three but otherwise good to move ahead.',
  'The draft you sent over looks sharp. I only have a couple of edits, nothing structural. Happy to jump on a quick call if easier.',
  'Saw this morning that the numbers landed better than we planned. Nice work on pushing that through.',
  'Small thing, but could you double-check the date in the second section? Might be a typo from the merge.',
  'Had a thought on the pricing side. Not urgent, but I will write it up when I get a minute.',
  'Running between meetings today but wanted to confirm the plan for tomorrow is still on.',
  'Honestly this is the cleanest version I have seen so far. Let us ship it and iterate if needed.',
  'No rush on this — whenever you get a chance to review is totally fine.',
  'Quick reminder to loop in finance before Friday. I will handle the rest of the trail.',
  'Tried the new flow you mentioned. It is noticeably faster, which is exactly what we wanted.',
];

const CLOSERS = [
  'Thanks!', 'Cheers,', 'Best,', 'Talk soon,', 'Appreciate it,',
  'Much appreciated,', 'Have a good one,', 'Speak soon,',
];

const NAMES = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Drew', 'Robin', 'Blake', 'Quinn'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function generateWarmupMessage({ fromName, toName }) {
  const subject = pick(SUBJECTS);
  const opener = pick(OPENERS).replace(/\byou\b/, toName ? toName : 'you');
  const body = pick(BODIES);
  const closer = pick(CLOSERS);
  const name = fromName || pick(NAMES);
  const text = `${opener}\n\n${body}\n\n${closer}\n${name}`;
  const html = `<p>${opener}</p><p>${body}</p><p>${closer}<br/>${name}</p>`;
  return { subject, text, html };
}

const REPLIES = [
  'Thanks for this — will take a look and get back to you.',
  'Got it, appreciate the heads up.',
  'Makes sense. Let me digest and circle back.',
  'Sounds good, thanks!',
  'Yep, on it. Will send over my notes shortly.',
  'Great, thanks for the quick turnaround.',
  'Agreed, good to move ahead.',
  'Noted — will build it in and share an update this week.',
];

export function generateReply({ fromName }) {
  const text = `${pick(REPLIES)}\n\n${pick(CLOSERS)}\n${fromName || pick(NAMES)}`;
  const html = `<p>${text.split('\n\n')[0]}</p><p>${text.split('\n\n')[1].replace('\n', '<br/>')}</p>`;
  return { text, html };
}

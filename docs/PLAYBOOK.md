# Playbook: from a signal to a paying customer

The radar finds people. This is what to do next. Most of it is manual, and it should be, because the goal of the first few weeks is **conversations, not code**.

## The daily 10 minutes

1. Open the digest. Look at **🔥 Repeated pain** first, then the top 3 asks.
2. For anything that makes you think "I could build that", open the link and read the whole thread. Replies often contain more pain than the original post ("same here, we pay £X for Y and it still doesn't…").
3. Keep a simple list (a note or spreadsheet): *problem · who · where you saw it · link · "would pay?" evidence*. When the same row keeps growing, that's your candidate.

## What counts as a strong signal

Strongest first:

1. **Money already moving**: they pay for a tool they hate, pay a freelancer to do it by hand, or have a budget (tenders, "happy to pay £X").
2. **Repeated**: different people, different places, same problem, over weeks. One viral rant doesn't count.
3. **Specific workflow**: "every Friday I export from X, fix it in Excel, email it to Y" beats "admin is annoying".
4. **Business, not hobby**: a sole trader losing hours is a customer; a hobbyist wishing is not.
5. **A named incumbent**: complaining about Xero/Jobber/etc. proves the market exists and people pay in it.

Weak: upvotes alone, "cool idea!", people saying they *would* use it.

## Turning a post into a conversation (without spamming)

- **Reply in the thread with something genuinely useful first**: an answer, a workaround, the tool that already exists. No links to your stuff on first contact. Read each community's self-promotion rules; Hacker News and most subreddits punish drive-by promotion.
- If they engage, ask to chat: *"I'm looking into exactly this problem. Could I ask you three questions about how you handle it today? No pitch."*
- For tenders: the buyer and the eventual supplier are both leads. Awarded contracts (Contracts Finder, next on the roadmap) tell you who sells to the public sector and what they charge.

## The questions to ask (The Mom Test)

From Rob Fitzpatrick's *The Mom Test*: ask about **their past behaviour**, never about your idea, because people are polite about ideas and honest about their week.

- "How are you handling this today?"
- "When did it last cause a problem? What happened?"
- "What have you already tried? What did it cost?"
- "Who else deals with this?"

Warning signs: compliments, "I would definitely use that", hypotheticals. Good signs: they've already spent money or hacked together a fix, they ask when they can have it, they introduce you to someone else with the problem.

## Sell before you build

When one problem has 5–10 real conversations behind it:

1. Write a one-page landing page **in their words**. The digests are full of the exact phrases people use (Amy Hoy calls this "Sales Safari").
2. Offer a **pre-order or paid pilot** (a Stripe payment link is enough). Five people paying £20 beats 500 upvotes.
3. Only then build the smallest thing that does the job, often by hand behind the scenes at first.

Rob Walling's "stair-step" advice fits a solo founder: start with a small, one-problem product in a niche you can reach, and prefer problems where **a business pays**.

## Picking a niche

After two weeks of digests, look at the `niche` labels Claude adds and the repeated-pain groups. Pick one where:

- you can reach the people (you know where they talk),
- they have money and the problem costs them time or money weekly,
- there's an incumbent people complain about, or a regulatory deadline forcing change.

Then add it to `niches` in `config/radar.config.ts` so the radar leans towards it, and add that niche's paid apps to the App Store list.

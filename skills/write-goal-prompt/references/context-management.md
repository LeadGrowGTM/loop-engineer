# Context Management: 170k Threshold

`/compact` compresses context in-place — Claude keeps working with a summary.

**Why 170k, not turn-based:** Turn-based cadence (every N turns) is unreliable — some
turns consume 500 tokens, others 15k. Context-based compaction triggers when it matters.
170k leaves ~30k headroom in a 200k window for the compacted summary + next action.

The checkpoint signal after compacting is critical — it prevents the agent from losing
track of multi-phase work:

> "After compacting, state: which phase you're in, what's complete, what file you're
> working on, what's next. Then continue."

# session-usage

A Claude Code mod that shows a usage pane: a donut of your 5-hour window (this chat vs. other usage vs. free) with a subtle weekly-usage ring, plus context tokens and session cost in the status line. `/usage` reopens the pane.

"This chat" is an estimate: the growth of the 5-hour figure since the session started.

## Install

In a terminal session:

```
/plugin install session-usage --marketplace davidmakoto/session-usage
```

From a shell:

```
claude plugin install session-usage --marketplace davidmakoto/session-usage
```

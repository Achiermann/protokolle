ONLY follow the following instructions if explicitly told:

<!-- .1 Task -->

Now lets add a login logic. Use the modern best practices there are to achieve this, but keep the styling close to the design of the website as is atm.

Also you may need to update the supabase table schema "protokolle" for this. Make sure to use the supabase MCP. Its already installed.

A user logs in with an email adress and a passwort that can be reset via email code (use resend to achieve the email sending).

When loged in, the user should choose a workspace or create on if there is no workspace connected to the user. 

## current data in "protokolle" table
create a column "workspace" on each table of the "protokolle" schema in supabase and connect all current existing data in the "protokolle" table to the workspace "Soybomb"


<!-- .2 Disclaimer -->

Don`t make any other changes then the ones explicitly mentioned here or in any of the mentioned instruction-files.
Follow DECISIONS.md, CLAUDE.md, STYLE-GUIDE.md, TESTING.md, PROMPT.md


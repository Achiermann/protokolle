ONLY follow the following instructions if explicitly told:

<!-- .1 Task -->

In the app, right now the users are stored in supabase auth directly.
since this is the protokolle app and all data should be stored in the schema "protokoll_app" 
there is also a table "users" where all users should be stored to.

no users in supabase auth, unless you highly recommend to go this way. but the big disatvantage about this is, that all users for all apps (which live in the same supabase project) will then be stored there and i might lose track over stuff.

USE THE SUPABASE MCP FOR THIS TASK

<!-- .2 Disclaimer -->

Don`t make any other changes then the ones explicitly mentioned here or in any of the mentioned instruction-files.
Follow DECISIONS.md, CLAUDE.md, STYLE-GUIDE.md, TESTING.md, PROMPT.md


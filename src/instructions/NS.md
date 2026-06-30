ONLY follow the following instructions if explicitly told:

<!-- .1 Task -->

the "todo-list-item-title" in the "todo-list-table" should behave exactly like the "entry-list-table-row"
meaning they should be clickable and open a "entry-list-detail-panel". 

behaviour:
- the done to dos should still be displayed under "erledigt", but not be striked through.
- create another table between the one with the header saying "offen" and the one with "erledigt", make it say "in bearbeitung". this table will display all todos that have a comment, but are not checked yet / not done. hence the second (new) table has the same columns as the "offen" table, and 
also a checkbox.
- when a todo has a comment, add a "message-square-check" from lucide react in front of the "todo-list-item-title".

but before we start we`ll have to decide how the todos get stored. investigate how the todos get fetched now. they come from the entries table in the db via the zustand store, right? elaborate on how they get fetched. it would probably be wise to change the home of the to do, give it a new dedicated table. lets find that out together. you have access to the supabase.

<!-- .2 Disclaimer -->

Don`t make any other changes then the ones explicitly mentioned here or in any of the mentioned instruction-files.
Follow DECISIONS.md, CLAUDE.md, STYLE-GUIDE.md, TESTING.md, PROMPT.md


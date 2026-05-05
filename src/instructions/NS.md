ONLY follow the following instructions if explicitly told:

<!-- .1 Task -->

## DISCLAIMER
I cant connect my supabase mcp to claude extention so i have to provide you with all information about supabase entries and tables. the schema is called "protokoll_app" provide me with sql commands to edit tables or give you context. 

## Tasks

1. Kulturförderung Kanton Zürich
Also take the data of "Projektbeiträge" of the "Kulturförderung Kanton Zürich"and put it in the 
"eingabefristen" list.

Find all info needed here: https://www.zh.ch/de/sport-kultur/kultur/kulturfoerderung/kulturschaffende-projekte/musik.html#-1846433621

If youve already built a mechanism for scraping the pages for staying in sync, put the Kulturförderung Kanton Zürich in that mechanism.

2. Kulturförderung Stadt Winterthur
The same task as point 1 but with "Kulturförderung Stadt Winterthur" get all info here 
https://stadt.winterthur.ch/themen/leben-in-winterthur/kultur/kulturfoerderung/projektfoerderung

2. Förderbereiche
Under "Förderbereiche" i want a table that has clickable fields. A field should have a light greytone if not active, and a pastel color if active. the goal of the table is to filter the ".förderstellen" from the table "förderungen" in the db schema "orgaprof" by certain criteria. 

## contents of the table.

1. First column says "Kanton" and shows all different rows from förderungen.kanton
There should also be a row saying "Übergreifend" that will show all options with "förderungen.kanton" === NULL

2. Second column will say "Projekte"
rows (options) are "Konzerttournee Inland", "Konzerttournee Ausland", "Tonträgerproduktion", "Promotion und Diffusion"

## scrape websites for info
Scrape the following websites:
https://www.zh.ch/de/sport-kultur/kultur/kulturfoerderung/kulturschaffende-projekte/musik.html#-1846433621

https://stadt.winterthur.ch/themen/leben-in-winterthur/kultur/kulturfoerderung/projektfoerderung

https://www.stadt-zuerich.ch/de/stadtleben/kultur/kultur-foerdern/uebersicht-foerdermassnahmen/musikproduktionsbeitrag-jazz-rock-pop.html

https://www.sz.ch/bildungsdepartement/amt-fuer-kultur/kulturfoerderung/beitraege-und-foerderung/beitragsgesuche.html/8756-8758-8802-9466-9471-9923-9992-9993

https://engagement.migros.ch/de/foerderung-beantragen/kulturprozent-migros-zuerich

scrape the sites for infos about the criteria needed for the table above. read all pdfs on the websites. they might be called "Richtlinien" or "Merkblatt" or similar. read all of it. Gather the info and put it in the db as an array. the idea is to have arrays with all options that apply for that foundation. 

<!-- .2 Disclaimer -->

Don`t make any other changes then the ones explicitly mentioned here or in any of the mentioned instruction-files.
Follow DECISIONS.md, CLAUDE.md, STYLE-GUIDE.md, TESTING.md, PROMPT.md


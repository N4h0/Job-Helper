# Job-Helper

.vscode includes settings for vscode spesific. As of now, the only settings there hide latex-files.
credentials is a folder which stores any keys, and is included in gitignore. Makes sure to add the folder and you own keys if you, or anyone, for some weird reason, decide to copy my project.
Jobs contains json-objects of all jobs added to sheets.
CVer stores simple text formats of my "CVs", which is used to prompt the LLM when generating Cover letters and CVs.
LatexCV includes all latex files, which are used to generate a PDF of my CV. Inside latex, contentTemplates are tempaltes for my CV in different languages, and content.tex is the only fil which is used to edit text for my CV. 
Scrapers includes websites which this extention can be used for, and containt the logic to extract information from the html.
Utils include a variety of files for different purposes. 
debug-latest-job is a jsob-object of the last extracted job.

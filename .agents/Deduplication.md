1. Read .agents/README.md
2. Read DUPLICATION_REPORT.md briefly to understand what it is.
3. Understand that I want ATOMIC commits. The smallest meaningful group of verifiable changes that don't fail npm run compile should get committed.
4. Start iterating over the duplication report and eliminate duplication but remember to
- ignore "duplications" that are really just import statements and comments.
- BE SURE to eliminate duplications where the methods are doing similar tasks. and be sure to this inteliggently so as to not break functionality. You may have to add new parameters or extract some subset of the logic into new functions so it can be reused. THE GOAL IS TO ELIMINATE repetition. 

Be watchful of cases where an attempt to eliminate duplication doesn't really reduce line count. for example, maybe multiple methods do a check like 
```
if (!result) {
return
}
```
but trying to factor this out into a method will result in something like:
```
if (!resultVerifier()) {
return;
}
```
so it doesn't really help. 
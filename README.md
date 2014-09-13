redact
======

Javascript redaction module

redact will do a simple walk of the structure and substitute values.
Redaction is done in-place but the ref to the input is
returned as a convenience.
```
  Redact.simple(object); // same-length Xing for strings, 999 for numbers, 2001-01-01 for dates
  Redact.simple(object, spec);
where spec is an array of regex-model pairs.  Models:
1.  slx (same-length Xs)
2.  del (removes the entry entirely)
3.  sub (substitute STRINGS with a unique value for this field)
e.g. r = Redact.simple(object, [{"^ssn":"del"},{"^accountId":"slx"}]);
```

The array of regex is evaluated in order; thus, be mindful of broader
matching patterns appearing near the front of the list.  


```
q = Redact.context(spec);
while(condition) {
  q.redact(object);
}
```
Context mode preserves atate across iterations.  The sub model works "as
expected" in this mode because only with state can the values in the field
from previously processed documents be assessed.

For example, if a doc array contains this:
```
  { _id: 1, "name": "buzz", "corn":"dog" }
  { _id: 2, "name": "anthony", "corn":"dog" }
  { _id: 3, "name": "anthony", "corn":"dog" }
  { _id: 4, "name": "buzz", "corn":"dog" }
  { _id: 5, "name": "steve", "corn":"husk" }
```
then 
```
  q = Redact.context([{"^name":"sub"},{"^corn":"sub"}]); 
  docset.forEach(function(r){q.redact(r)});
```
will yield
```
  { _id: 1, "name": "KEY0", "corn":"KEY1" }
  { _id" 2, "name": "KEY2", "corn":"KEY1" }
  { _id" 3, "name": "KEY2", "corn":"KEY1" }
  { _id" 4, "name": "KEY0", "corn":"KEY1" }
  { _id" 5, "name": "KEY3", "corn":"KEY4" }
```
The sub model is permitted for non-context operations but in this case 
it acts just like a basic substitution redaction; strings will "blindly"
be substituted with KEYn with n starting over at 0 for each record.

More on regexp and non-scalars (containers):
If a regexp matches a object or array name, then the model associated with
it will be applied recursively to the entire contents of the container.  
The model will be applied even if other regexp/model pairs exist later in the
argument list that more narrowly match the contents.  Care must be taken
to ensure that later pairs do not operate incorrectly on previously 
redacted material.

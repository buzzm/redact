redact
======

Javascript redaction module

redact walks javascript objects and substitutes or removes values.
Redaction is done in-place but the ref to the input is
returned as a convenience.

The redaction specification ("spec") is an array of field-model pairs (an
array of single name:value maps).
There are two functions for different styles of field:  simple and regexp:
 * "simple" assumes dot-notation listing of fields
 * "regexp" allows more sophisticated regular expressions to be used, but 
    requires the caller to take care in escaping dots.

The following models are available for both styles:
 *  slx:  Substitute strings for same-length Xs (e.g. "buzz" -> "XXXX"),
          numbers with 999, and dates with 2001-01-01
 *  del:  Removes the entry entirely
 *  sub:  Substitute strings ONLY with a unique value for this field

The array of fields is evaluated in order; thus, be mindful of broader
regex matching patterns appearing near the front of the list.  

Both styles are accessible from static methods ("one-shot") and 
a stateful object with context.

The examples below will use this javascript object as input:
```
var m = {
hat": "derby",
    "cat": "persian",
    "nestedArray" : [ "hat", {"ssn": "111-11-1111"}, [ "b", "c" ], {"ssn": "222-22-2222"} ],
nestedDoc": {
   "hat": "fedora",
        "cat": "calico",
        "ssn": "000-00-0000"

}
```

```
  Redact.simple(object)
  Same-length Xing for strings, 999 for numbers, 2001-01-01 for dates.
  Redacts every field.

Redact.simple(m, [
    {"hat":"slx"},
    {"cat":"slx"},
    {"nestedDoc.ssn":"del"}
  ]);
*    {
  "hat" : "XXXXX",
  "cat" : "XXXXXXX",
  "nestedArray" : [
    "hat",
    { "ssn" : "111-11-1111" },
    [ "b", "c" ],
    { "ssn" : "222-22-2222" }
  ],
  "nestedDoc" : {
    "hat" : "fedora",
  	"cat" : "calico"
  	}
  }
Note "hat" and "cat" in the nestedDoc are unchanged and only the 
ssn field in the nestedDoc has been deleted


Redact.regexp(m, [
    {"hat":"slx"}
  ]);
    {
  "hat" : "XXXXX",
  "cat" : "persian",
  "nestedArray" : [
    "hat",
    { "ssn" : "111-11-1111" },
    [ "b", "c" ],
    { "ssn" : "222-22-2222" }
  ],
  "nestedDoc" : {
    "hat" : "XXXXXX",
  	"cat" : "calico"
    "ssn" : "000-00-0000"
  	}
  }
Both hat and nestedDoc.hat are redacted.  The value "hat" in the
nestedArray is unchanged because it is a value, not a field.

To "crisply" redact all ssn, make sure the last component in the dotpath
looks like ".ssn".  This prevents matching against bossname, for example.
Redact.regexp(m, [
    {"\\.ssn$":"slx"}
  ]);
   {
  "hat" : "derby",
  "cat" : "persian",
  "nestedArray" : [
    "hat",
    { "ssn" : "XXXXXXXXXXX" },
    [ "b", "c" ],
    { "ssn" : "XXXXXXXXXXX" }
  ],
  "nestedDoc" : {
    "hat" : "fedora",
  	"cat" : "calico"
    "ssn" : "XXXXXXXXXXX"
  	}
  }

Contents of arrays are identified using .n notation where n starts at 0.
In the sample above, two substructures containing a field "ssn" exist at
nestedArray.1.ssn and nestedArray.3.ssn  Thus, to redact all ssn fields in
the nestedArray, match on "nestedArray.{oneOrMoreNumbers}.ssn"
  Redact.regexp(mkm2(), [
    {"nestedArray\.[0-9]+\.ssn$":"slx"}
  ]);
  {
  "hat" : "derby",
  "cat" : "persian",
  "nestedArray" : [
    "hat",
    { "ssn" : "XXXXXXXXXXX" },
    [ "b", "c" ],
    { "ssn" : "XXXXXXXXXXX" }
  ],
  "nestedDoc" : {
    "hat" : "fedora",
  	"cat" : "calico"
    "ssn" : "000-00-0000"
  	}
  }
```

Context mode preserves atate across iterations.  The sub model works "as
expected" in this mode because only with state can the values in the field
from previously processed documents be assessed.  There are two methods,
contextSimple and contextRegexp.
```
q = Redact.contextRegexp(spec);
while(condition) {
  q.redact(object);
}
For example, if a set of objects contains this:
  { _id: 1, "name": "buzz", "corn":"dog" }
  { _id: 2, "name": "anthony", "corn":"dog" }
  { _id: 3, "name": "anthony", "corn":"dog" }
  { _id: 4, "name": "buzz", "corn":"dog" }
  { _id: 5, "name": "steve", "corn":"husk" }
then 
  q = Redact.context([{"^name":"sub"},{"^corn":"sub"}]); 
  docset.forEach(function(r){q.redact(r)});
will yield
  { _id: 1, "name": "KEY0", "corn":"KEY1" }
  { _id" 2, "name": "KEY2", "corn":"KEY1" }
  { _id" 3, "name": "KEY2", "corn":"KEY1" }
  { _id" 4, "name": "KEY0", "corn":"KEY1" }
  { _id" 5, "name": "KEY3", "corn":"KEY4" }
```
Note: the "sub" model is available for non-context operations but in this
case it acts just like a basic substitution redaction; strings will
"blindly" be substituted with KEYn with n starting over at 0 for each
record.

Context also provides a facility to change the date and numeric slx
replacements with setDateVal(Date) and setNumVal(number):
```
q = Redact.contextRegexp(spec);
q.setDateVal(new Date(1980,1,1));
```

More on regexp and non-scalars (containers):
If a regexp matches a object or array name, then the model associated with
it will be applied recursively to the entire contents of the container.  
The model will be applied even if other regexp/model pairs exist later in the
argument list that more narrowly match the contents.  Care must be taken
to ensure that later pairs do not operate incorrectly on previously 
redacted material.


License
-------
Copyright (C) {2014} {Buzz Moschetti}

This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; either version 2 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.


Disclaimer
----------

This software is not supported by MongoDB, Inc. under any of their commercial support subscriptions or otherwise. Any usage of redact is at your own risk. Bug reports, feature requests and questions can be posted in the Issues section here on github.

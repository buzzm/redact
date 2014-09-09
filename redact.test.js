load("/Users/buzz/js/lib/redact.js");

d1 = new Date(2011,2,2);
d2 = new Date(2013,3,3);

mkm = function() {
    var m1 = {"name": "Buzz",
	  "date1": d1,
	  "hat": 12,
	  "nestedArray" : [ "hat", [ "b", "c", d2 ], [ 3.4 ]],
	  "nestedDoc": {
	    "hat": "fedora",
	    "cat": "not a dog"
	},
	  "b": "moschetti",
	  "q": [ 12, "value"]
    };
    return m1;
}

var m1 = mkm();
Redact.simple(m1);
print("Redact.simple(m1):");
printjson(m1);

var m1 = mkm();
Redact.simple(m1, {"hat":"slx"});
print("Redact.simple(m1,expr):");
printjson(m1);

var m1 = mkm();
Redact.simple(m1, {"^hat":"slx"});
print("Redact.simple(m1,expr):");
printjson(m1);





/***
print("\n\n");
print("Redact.context:");
var q = new Redact.context({"^name": "keymap", "^corn":"keymap"});
//var c = db.foo.find({}, { "name":1, "corn":1});
var c = db.foo.find();
while(c.hasNext()) {
    var r = c.next();
    q.redact(r);
    printjson(r);
}
***/
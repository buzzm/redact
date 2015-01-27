load("/Users/buzz/js/lib/redact.js");

/**
 *  This would be a whole heck of a lot easier if Javascript had
 *  MapCompare or something like it... 
 *
 *  So...
 *  For the moment, eyeballing it.
 *  yeah, yeah...
 */

d1 = new Date(2011,2,2);
d2 = new Date(2014,4,4);

mkm2 = function() {
  var m = {
    "hat": "derby",
    "hatter": "mad",
    "cat": "persian",
    "age": 12,
    "dob": d1,
    "doh": d2,
    "nestedArray" : [ "hat", {"ssn": "111-11-1111"}, [ "b", "c" ], {"ssn": "222-22-2222"}, {"ssn": "222-22-2222"} ],
    "bossname": "TheBoss",
    "nestedDoc": {
        "hat": "fedora",
        "cat": "calico",
        "ssn": "000-00-0000"
    }
  };
  return m;
}

txre = function(desc, expr) {
    var m1 = mkm2();    
    print(desc);
    Redact.regexp(m1, expr);
    print("expr: " + tojson(expr));
    print("redacted output:");
    printjson(m1);
}
txsimple = function(desc, expr) {
    var m1 = mkm2();    
    print(desc);
    Redact.simple(m1, expr);
    print("expr: " + tojson(expr));
    print("redacted output:");
    printjson(m1);
}


txsimple("null arg; redact all", null);
txre("all hat", [{"hat":"slx"}]);
txre("top hat only", [{"^hat":"slx"}]);
txre("top hat full only", [{"^hat$":"slx"}]);
txsimple("nested hat full only", [{"nestedDoc.hat":"slx"}]);
txre("all nested doc slx", [{"^nestedDoc":"slx"}] );
txre("all nested doc sub (not very exciting)", [{"^nestedDoc":"sub"}] );
txre("nested array sub (sort of weird)", [{"^nestedArray":"sub"}] );
txre("all ssn", [{"ssn":"del"}]);
txre("only ssn in nestedArray w/strict dotpath", [ {"nestedArray\.[0-9]+\.ssn$":"slx"} ]);
txre("only ssn in nestedArray w/lazy dotpath", [ {"nestedArray.+\.ssn$":"slx"} ]);
txre("only ssn in nestedArray w/strict dotpath; sub cannot do the like-value sub", [ {"nestedArray\.[0-9]+\.ssn$":"sub"} ]);
txsimple("only ssn in nestedDoc", [{"nestedDoc.ssn":"slx"}]);
txsimple("only ssn in nestedDoc", [{"nestedDoc.ssn":"sub"}]);

var ll = [
	  { "_id": 1, "name": "buzz", "corn":"dog", "dob": d1 },
	  { "_id": 2, "name": "anthony", "corn":"dog", "age": 12 },
	  { "_id": 3, "name": "anthony", "corn":"dog", "dob": d1 },
	  { "_id": 4, "name": "buzz", "corn":"dog" },
	  { "_id": 5, "name": "steve", "corn":"husk" }
	  ];
print("\n\n");
print("Redact.context:");

var q = new Redact.contextRegexp([{"^age":"slx"}, {"^dob":"slx"}, {"^name": "sub"},{"^corn":"sub"}]);
q.setDateVal(new Date(1988,5,5));
q.setNumVal(-1);

//var c = db.foo.find({}, { "name":1, "corn":1});

ll.forEach(function(r) {
	q.redact(r);
	printjson(r);
    });

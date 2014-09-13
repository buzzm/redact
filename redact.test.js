load("/Users/buzz/js/lib/redact.js");

d1 = new Date(2011,2,2);
d2 = new Date(2013,3,3);

mkm = function() {
    var m1 = {
	"name": "Buzz",
	"date1": d1,
	"hat": 12,
	"hatch": "portside",
	"nestedArray" : [ "hat", [ "b", "c", d2 ], [ 3.4 ]],
	"nestedDoc": {
	    "hat": "fedora",
	    "chat": "room",
	    "cat": "not a dog",
	    "mat": {
		"exp": "not an animal!",
		"foo": [ 1, 2, 3, 4, 5, 6, 7, 8 ],
		"bar": [ "E1", "E2" ]
	    },
	    "date1": d1
	},
	"b": "moschetti",
	"q": [ 12, "value"]
    };
    return m1;
}

tx = function(desc, expr) {
    var m1 = mkm();    
    print(desc);
    Redact.simple(m1, expr);
    print("expr: "); printjson(expr);
    printjson(m1);
}

tx("raw struct", null);

tx("all hat", [{"hat":"slx"}]);
tx("top hat only", [{"^hat":"slx"}]);
tx("top hat full only", [{"^hat$":"slx"}]);
tx("nested hat full only", [{"\\.hat$":"slx"}]);

tx("nested doc slx", [{"^nestedDoc":"slx"}] );
tx("nested doc sub", [{"^nestedDoc":"sub"}] );
tx("nested array", [{"^nestedArray":"sub"}] );



var ll = [
	  { "_id": 1, "name": "buzz", "corn":"dog" },
	  { "_id": 2, "name": "anthony", "corn":"dog" },
	  { "_id": 3, "name": "anthony", "corn":"dog" },
	  { "_id": 4, "name": "buzz", "corn":"dog" },
	  { "_id": 5, "name": "steve", "corn":"husk" }
	  ];

print("\n\n");
print("Redact.context:");
var q = new Redact.context([{"^name": "sub"},{"^corn":"sub"}]);
//var c = db.foo.find({}, { "name":1, "corn":1});
ll.forEach(function(r) {
	q.redact(r);
	printjson(r);
    });

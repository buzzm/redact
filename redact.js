/**
 *  redact walks javascript objects and substitutes or removes values.
 *  Redaction is done in-place but the ref to the input is
 *  returned as a convenience.
 *
 *  The redaction specification ("spec") is an array of field-model pairs (an
 *  array of single name:value maps)
 *  There are two functions for different styles of field:  simple and regexp:
 *  1.  "simple" assumes dot-notation listing of fields
 *  2.  "regexp" allows more sophisticated regular expressions to be used, but 
 *      requires the caller to take care in escaping dots.
 *  The following models are available for both styles:
 *  1.  slx:  Substitute strings for same-length Xs (e.g. "buzz" -> "XXXX"),
 *            numbers with 999, and dates with 2001-01-01
 *  2.  del:  Removes the entry entirely
 *  3.  sub:  Substitute strings ONLY with a unique value for this field
 *  The array of fields is evaluated in order; thus, be mindful of broader
 *  regex matching patterns appearing near the front of the list.  
 *
 *  Both styles are accessible from static methods ("one-shot") and 
 *  a stateful object with context.
 *  
 *  The examples below will use this javascript object as input:
 *  var m = {
 *	"hat": "derby",
 *      "cat": "persian",
 *      "nestedArray" : [ "hat", {"ssn": "111-11-1111"}, [ "b", "c" ], {"ssn": "222-22-2222"} ],
 *	"nestedDoc": {
 *	    "hat": "fedora",
 *          "cat": "calico",
 *          "ssn": "000-00-0000"
 *	}
 *  }
 * 
 *  Redact.simple(object)
 *    Same-length Xing for strings, 999 for numbers, 2001-01-01 for dates.
 *    Redacts every field.
 *
 *
 *  Redact.simple(m, [
 *      {"hat":"slx"},
 *      {"cat":"slx"},
 *      {"nestedDoc.ssn":"del"}
 *    ]);
 *
 *    {
 *    "hat" : "XXXXX",
 *    "cat" : "XXXXXXX",
 *    "nestedArray" : [
 *      "hat",
 *      { "ssn" : "111-11-1111" },
 *      [ "b", "c" ],
 *      { "ssn" : "222-22-2222" }
 *    ],
 *    "nestedDoc" : {
 *      "hat" : "fedora",
 *    	"cat" : "calico"
 *    	}
 *    }
 * 
 *  Note "hat" and "cat" in the nestedDoc are unchanged and only the 
 *  ssn field in the nestedDoc has been deleted
 *  
 *  Redact.regexp(m, [
 *      {"hat":"slx"}
 *    ]);
 *
 *    {
 *    "hat" : "XXXXX",
 *    "cat" : "persian",
 *    "nestedArray" : [
 *      "hat",
 *      { "ssn" : "111-11-1111" },
 *      [ "b", "c" ],
 *      { "ssn" : "222-22-2222" }
 *    ],
 *    "nestedDoc" : {
 *      "hat" : "XXXXXX",
 *    	"cat" : "calico"
 *      "ssn" : "000-00-0000"
 *    	}
 *    }
 *
 *  Both hat and nestedDoc.hat are redacted.  The value "hat" in the
 *  nestedArray is unchanged because it is a value, not a field.
 *
 *
 *  To "crisply" redact all ssn, make sure the last component in the dotpath
 *  looks like ".ssn".  This prevents matching against bossname, for example.
 *  Redact.regexp(m, [
 *      {"\\.ssn$":"slx"}
 *    ]);
 *
 *    {
 *    "hat" : "derby",
 *    "cat" : "persian",
 *    "nestedArray" : [
 *      "hat",
 *      { "ssn" : "XXXXXXXXXXX" },
 *      [ "b", "c" ],
 *      { "ssn" : "XXXXXXXXXXX" }
 *    ],
 *    "nestedDoc" : {
 *      "hat" : "fedora",
 *    	"cat" : "calico"
 *      "ssn" : "XXXXXXXXXXX"
 *    	}
 *    }
 *
 *
 *  Contents of arrays are identified using .n notation where n starts at 0.
 *  In the sample above, two substructures containing a field "ssn" exist at
 *  nestedArray.1.ssn and nestedArray.3.ssn  Thus, to redact all ssn fields in
 *  the nestedArray, match on "nestedArray.{oneOrMoreNumbers}.ssn"
 *    Redact.regexp(mkm2(), [
 *      {"nestedArray\.[0-9]+\.ssn$":"slx"}
 *    ]);
 *    {
 *    "hat" : "derby",
 *    "cat" : "persian",
 *    "nestedArray" : [
 *      "hat",
 *      { "ssn" : "XXXXXXXXXXX" },
 *      [ "b", "c" ],
 *      { "ssn" : "XXXXXXXXXXX" }
 *    ],
 *    "nestedDoc" : {
 *      "hat" : "fedora",
 *    	"cat" : "calico"
 *      "ssn" : "000-00-0000"
 *    	}
 *    }
 *  
 *
 *
 *  Context mode preserves atate across iterations.  The sub model works "as
 *  expected" in this mode because only with state can the values in the field
 *  from previously processed documents be assessed.  There are two methods,
 *  contextSimple and contextRegexp.
 *
 *  q = Redact.contextRegexp(spec);
 *  while(condition) {
 *    q.redact(object);
 *  }
 *  For example, if a set of objects contains this:
 *    { _id: 1, "name": "buzz", "corn":"dog" }
 *    { _id: 2, "name": "anthony", "corn":"dog" }
 *    { _id: 3, "name": "anthony", "corn":"dog" }
 *    { _id: 4, "name": "buzz", "corn":"dog" }
 *    { _id: 5, "name": "steve", "corn":"husk" }
 *  then 
 *    q = Redact.context([{"^name":"sub"},{"^corn":"sub"}]); 
 *    docset.forEach(function(r){q.redact(r)});
 *  will yield
 *    { _id: 1, "name": "KEY0", "corn":"KEY1" }
 *    { _id" 2, "name": "KEY2", "corn":"KEY1" }
 *    { _id" 3, "name": "KEY2", "corn":"KEY1" }
 *    { _id" 4, "name": "KEY0", "corn":"KEY1" }
 *    { _id" 5, "name": "KEY3", "corn":"KEY4" }
 *
 *  Note: the "sub" model is available for non-context operations but in this
 *  case it acts just like a basic substitution redaction; strings will
 *  "blindly" be substituted with KEYn with n starting over at 0 for each
 *  record.
 * 
 *  Context also provides a facility to change the date and numeric slx
 *  replacements with setDateVal(Date) and setNumVal(number):
 *  q = Redact.contextRegexp(spec);
 *  q.setDateVal(new Date(1980,1,1));
 *
 *
 *  More on regexp and non-scalars (containers):
 *  If a regexp matches a object or array name, then the model associated with
 *  it will be applied recursively to the entire contents of the container.  
 *  The model will be applied even if other regexp/model pairs exist later in the
 *  argument list that more narrowly match the contents.  Care must be taken
 *  to ensure that later pairs do not operate incorrectly on previously 
 *  redacted material.
 *
 *  -Buzz, August 2014
 */
var Redact = (function() {
	var my = {}; // state context for this "object"

	my.locals = {};

	my.locals.bigx = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
	my.locals.bigxl = my.locals.bigx.length;

	my.locals.dateval = new ISODate("2001-01-01");
	my.locals.numval = 999;

	//  delete = 0
	//  slx = 1
	//  hash

	chkRedact = function(ncp) {
	    var x = -1;

	    for(j = 0; j < my.locals.rexl; j++) {
		var doit = my.locals.rex[j].test(ncp);

		//print("  " + ncp + " " + my.locals.rex[j] + " " + doit);

		if(doit == true) {
		    x = j;
		    break;
		}
	    }
	    return x;
	}


	processItem = function(curp, nkey, ov_a, parentRidx) {	
	    var rval = { "action": false, value: null };

	    var rfunc = -1;
	    var ridx = -1;

	    if(curp.length == 0) {
		ncp = nkey;
	    } else {
		ncp = curp + "." + nkey; 
	    }

	    if(parentRidx == -1) {
		ridx = chkRedact(ncp);
	    } else {
		ridx = parentRidx;
	    }

	    if(ov_a instanceof Array) {
		if(ridx != -1) {
		    rfunc = my.locals.func[ridx];
		    switch(rfunc) {
		    case 0:
			rval.action = true;
			rval.value = null;
			break;

		    default:
			walkList(ncp, ov_a, ridx);
			break;
		    }

		} else {
		    walkList(ncp, ov_a, -1);
		}

	    } else if(ov_a instanceof Date) {
		if(my.locals.onlyleaf || ridx != -1) {
		    rfunc = my.locals.func[ridx];
		    rval.action = true;

		    switch(rfunc) {
		    case 0:
			rval.value = null; // delete
			break;
		    default:
			rval.value = my.locals.dateval;
			break;
		    }
		}
		//print("  is Date; new date " + new_v);

	    } else if(ov_a instanceof ObjectId) {
		new_v = null;
		//print("  is Date; new date " + new_v);


	    } else if(ov_a instanceof Object) {
		//print("  is Object; walk map");
		if(ridx != -1) {
		    rfunc = my.locals.func[ridx];
		    switch(rfunc) {
		    case 0:
			rval.action = true;
			rval.value = null;
			break;

		    default:
			walkMap(ncp, ov_a, ridx);
			break;
		    }

		} else {
		    walkMap(ncp, ov_a, -1);
		}


	    } else {

		if(ridx != -1) {
		    rfunc = my.locals.func[ridx];
		    rval.action = true;
		} else if(my.locals.onlyleaf == true) {
		    rfunc = 1;
		    rval.action = true;
		}

		if(rfunc == 0) {
		    rval.value = null;
		} else {
		    var cl = typeof(ov_a);
		    if(cl == "string") {
			switch(rfunc) {
			case 1: // slx
			    var n = ov_a.length;
			    var xs = my.locals.bigx;
			    if(n > my.locals.bigxl) {
				var z = Math.floor(n/my.locals.bigxl);
				for(var u = 0; u < z; u++) {
				    xs = xs.concat(my.locals.bigx);
				}
			    }
			    rval.value = xs.substr(0,n);
			    break;

			case 2: // sub
			    if(my.locals.keymap[ncp] == null) {
				my.locals.keymap[ncp] = {};
			    }
			    var mk = my.locals.keymap[ncp][ov_a];
			    if(mk == null) {
				mk = ("KEY" + my.locals.keymapcnt);
				my.locals.keymap[ncp][ov_a] = mk;
				my.locals.keymapcnt++;
			    }
			    
			    rval.value = mk;
			    break;
			}
			
		    } else if(cl == "number") {
			switch(rfunc) {
			case 1: // slx
			rval.value = my.locals.numval;
			break;

			default:
			rval.value = ov_a;
			break;
			}
			
		    }
		}
	    }

	    return rval;
	}


	walkMap = function(curp, a, parentRidx) {
	    Object.keys(a).forEach(function(key) {
		    var ov_a = a[key];
		    var rval = processItem(curp, key, ov_a, parentRidx);
		    if(rval.action == true) {
			if(rval.value != null) {
			    a[key] = rval.value;
			} else {
			    delete a[key];
			}
		    }
		});
	}


	walkList = function(curp, a, parentRidx) {
	    var c = a.length;
	    for(var jj = 0; jj < c; jj++) {
		var ov_a = a[jj];
		var rval = processItem(curp, ("" + jj), ov_a, parentRidx);
		if(rval.action == true) {
		    if(rval.value != null) {
			a[jj] = rval.value;
		    } else {
			a.splice(jj, 1);
		    }
		}
	    }
	}


	cvt2re = function(sarr) {
	    var rgx = null;

	    // Change . to \\. and wrap with anchors, e.g.
	    // foo.bar.baz  ->  ^foo\.bar\.baz$
	    //
	    // so iterate the input, capturing the val for each
	    // and changing the key...
	    //
	    if(sarr != null) {
		rgx = [];

		for(var jj = 0; jj < sarr.length; jj++) {
		    var item = sarr[jj];  // {re,model}
		    
		    var kk = Object.keys(item);
		    var key = kk[0];  // TBD assuming only 1...!
		    var val = item[key];
		    
		    var ng1 = key.split(".").join("\\.");
		    var ng2 = "^".concat(ng1, "$");
		    var newitem = {};
		    newitem[ng2] = val;
		    
		    rgx.push(newitem);
		}
	    }

	    return rgx;
	}



	my.setDateVal = function(a) {
	    my.locals.dateval = a;
	}

	my.setNumVal = function(a) {
	    my.locals.numval = a;
	}


	my.simple = function(a, sarr) {
	    var rgx = cvt2re(sarr);
	    var q = my.contextRegexp(rgx);
	    q.redact(a);
	    return a;
	}


	my.regexp = function(a, rgx) {
	    var q = my.contextRegexp(rgx);
	    q.redact(a);
	    return a;
	}




	my.redact = function(a) {
	    walkMap("", a, -1);
	    return a;
	}



	my.contextSimple = function(sarr) {
	    var rgx = cvt2re(sarr);
	    return my.contextRegexp(rgx);
	}

	my.contextRegexp = function(rgx) {

	    // expecting rgx to be an array of regex:redact modes:
	    // [
	    //   {"^ssn":"del"},
	    //   {"foo": "slx"}
	    // ]
	    // 
	    my.locals.rex = [];
	    my.locals.rexl = 0;
	    my.locals.func = [];
	    my.locals.keymap = {};
	    my.locals.keymapcnt = 0;
	    my.locals.onlyleaf = false;

	    if(rgx == null) {
		my.locals.onlyleaf = true;

	    } else {
		rgx.forEach(function(item) {
			var kk = Object.keys(item);
			var key = kk[0];  // TBD assuming only 1...!
		    my.locals.rex.push(new RegExp(key));

		    var ss = item[key];
		    var func = -1;
		    if     (ss == "del"){ func = 0; }
		    else if(ss == "slx"){ func = 1; }
		    else if(ss == "sub"){ func = 2; }
		    my.locals.func.push(func);
		});
		my.locals.rexl = my.locals.rex.length; // can be zero...
	    }
	    
	    return my;
	}


	return my;
}());


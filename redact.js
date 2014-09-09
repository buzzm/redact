/**
 *  redact will do a simple walk of the structure and 
 *  substitute values.  Redaction is done in-place but the ref to the input is
 *  returned as a convenience.
 *
 *  Redact.simple(object); // same-length Xing for strings, 999 for numbers, 2001-01-01 for dates
 *
 *  Redact.simple(object, spec);
 *  where spec is an object of regex-model pairs.  Models:
 *  1.  slx (same-length Xs)
 *  2.  delete (removes the entry entirely)
 *  e.g. r = Redact.simple(object, { "^ssn": "delete", "^accountId": "slx" });
 *
 *  Context mode preserves atate across iterations and is necessary for keymap model
 *  q = Redact.context(spec);
 *  while(condition) {
 *    q.redact(object);
 *  }
 *  keymap mode will create a value substitution for every unique string value found
 *  at path p.   If a set of documents look like this:
 *  { _id: 1, "name": "buzz", "corn":"dog" }
 *  { _id" 2, "name": "anthony", "corn":"dog" }
 *  { _id" 3, "name": "anthony", "corn":"dog" }
 *  { _id" 4, "name": "buzz", "corn":"dog" }
 *  { _id" 5, "name": "anthony", "corn":"dog" }
 *  then 
 *  q = Redact.context({"^name":"keymap","^corn":"keymap"}); 
 *  docset.forEach(function(r){q.redact(r)});
 *  will yield
 *  { _id: 1, "name": "KEY0", "corn":"KEY1" }
 *  { _id" 2, "name": "KEY2", "corn":"KEY1" }
 *  { _id" 3, "name": "KEY2", "corn":"KEY1" }
 *  { _id" 4, "name": "KEY0", "corn":"KEY1" }
 *  { _id" 5, "name": "KEY2", "corn":"KEY1" }
 *  
 *  -Buzz, August 2014
 */
var Redact = (function() {
	var my = {}; // state context for this "object"

	my.locals = {};

	my.locals.bigx = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
	my.locals.bigxl = my.locals.bigx.length;

	//  delete = 0
	//  slx = 1
	//  hash

	doRedact = function(ncp) {
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

	processItem = function(curp, nkey, ov_a) {	
	    var rval = { "action": false, value: null };

	    var rfunc = -1;
	    var ridx = -1;

	    if(curp.length == 0) {
		ncp = nkey;
	    } else {
		ncp = curp + "." + nkey; 
	    }

	    if(ov_a instanceof Array) {
		ridx = doRedact(ncp);
		if(ridx != -1) {
		    rval.action = true;
		    rval.value = null;
		    print("kill the list " + ncp);
		} else {
		    walkList(ncp, ov_a);
		}

	    } else if(ov_a instanceof Date) {
		ridx = doRedact(ncp);
		if(my.locals.onlyleaf || ridx != -1) {
		    rfunc = my.locals.func[ridx];
		    rval.action = true;

		    switch(rfunc) {
		    case 0:
			rval.value = null; // delete
			break;
		    default:
			rval.value = new ISODate("2001-01-01"); // TBD sub date should be configurable...
			break;
		    }
		}
		//print("  is Date; new date " + new_v);

	    } else if(ov_a instanceof ObjectId) {
		new_v = null;
		//print("  is Date; new date " + new_v);


	    } else if(ov_a instanceof Object) {
		//print("  is Object; walk map");
		ridx = doRedact(ncp);
		if(ridx != -1) {
		    rval.action = true;
		    rval.value = null;
		} else {
		    walkMap(ncp, ov_a);
		}


	    } else {
		var ridx = doRedact(ncp);

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

			case 2: // keymap
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
			rval.value = 999;
			break;
			}
			
		    }
		}
	    }

	    return rval;
	}


	walkMap = function(curp, a) {
	    Object.keys(a).forEach(function(key) {
		    var ov_a = a[key];
		    var rval = processItem(curp, key, ov_a);
		    if(rval.action == true) {
			if(rval.value != null) {
			    a[key] = rval.value;
			} else {
			    delete a[key];
			}
		    }
		});
	}


	walkList = function(curp, a) {
	    var c = a.length;
	    for(var jj = 0; jj < c; jj++) {
		var ov_a = a[jj];
		var rval = processItem(curp, ("" + jj), ov_a);
		if(rval.action == true) {
		    if(rval.value != null) {
			a[jj] = rval.value;
		    } else {
			a.splice(jj, 1);
		    }
		}
	    }
	}



	my.simple = function(a, rgx) {
	    var q = my.context(rgx);
	    q.redact(a);
	    return a;
	}


	my.redact = function(a) {
	    walkMap("", a);
	    return a;
	}

	my.context = function(rgx) {

	    // expecting rgx to be a hash of regex and redact modes:
	    // {
	    //   "^ssn": "delete",
	    //   "foo": "slx",
	    // }
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
		Object.keys(rgx).forEach(function(key) {
		    my.locals.rex.push(new RegExp(key));
		    var ss = rgx[key];
		    var func = -1;
		    if     (ss == "delete"){ func = 0; }
		    else if(ss == "slx")   { func = 1; }
		    else if(ss == "keymap"){ func = 2; }
		    my.locals.func.push(func);
		});
		my.locals.rexl = my.locals.rex.length; // can be zero...
	    }
	    
	    return my;
	}


	return my;
}());


/**
 *  redact will do a simple walk of the structure and substitute values.
 *  Redaction is done in-place but the ref to the input is
 *  returned as a convenience.
 *
 *  Redact.simple(object); // same-length Xing for strings, 999 for numbers, 2001-01-01 for dates
 *
 *  Redact.simple(object, spec);
 *  where spec is an array of regex-model pairs.  Models:
 *  1.  slx (same-length Xs)
 *  2.  del (removes the entry entirely)
 *  3.  sub (substitute STRINGS with a unique value for this field)
 *  e.g. r = Redact.simple(object, [{"^ssn":"del"},{"^accountId":"slx"}]);
 *
 *  The array of regex is evaluated in order; thus, be mindful of broader
 *  matching patterns appearing near the front of the list.  
 *
 *  Context mode preserves atate across iterations.  The sub model works "as
 *  expected" in this mode because only with state can the values in the field
 *  from previously processed documents be assessed.
 *  q = Redact.context(spec);
 *  while(condition) {
 *    q.redact(object);
 *  }
 *  For example, if a doc array contains this:
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
 *  The sub model is permitted for non-context operations but in this case 
 *  it acts just like a basic substitution redaction; strings will "blindly"
 *  be substituted with KEYn with n starting over at 0 for each record.
 * 
 *  More on regexp and non-scalars (containers):
 *  If a regexp matches a object or array name, then the model associated with
 *  it will be applied recursive to the entire contents of the container.  The
 *  model will be applied even if other regexp/model pairs exist that more 
 *  narrowly match the contents.
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
			print("  walk with parent redact func");
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
		if(ridx != -1) {
		    rfunc = my.locals.func[ridx];
		    switch(rfunc) {
		    case 0:
			rval.action = true;
			rval.value = null;
			break;

		    default:
			print("  walk with parent redact func");
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
			rval.value = 999;
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



	my.simple = function(a, rgx) {
	    var q = my.context(rgx);
	    q.redact(a);
	    return a;
	}


	my.redact = function(a) {
	    walkMap("", a, -1);
	    return a;
	}

	my.context = function(rgx) {

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


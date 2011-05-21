function get_file(path) {
    var ajax = $.ajax({ async: false, url: path });
    if (ajax.status != 200) {
	alert("Failed to load "+path);
	// TODO: abort.
    }
    return ajax.responseText;
}

function decode(str) {
    // TODO: unescape stuff.
    return str;
}

function piglit_parse(lines) {
    var i = 0;
    function next() {
	if (i < lines.length) {
	    i += 1;
	}
    }
    function parse_toplevel() {
	var globals = {};
	var tests = {};
	while (i < lines.length) {
	    var colon_loc = lines[i].indexOf(":");
	    if (colon_loc == -1) {
		break; // TODO: error
	    }
	    var key = lines[i].slice(0, colon_loc);
	    var value = lines[i].slice(colon_loc + 2);
	    next();
	    if (key == "@test") {
		tests[value] = parse_dict();
	    } else {
		globals[key] = decode(value);
	    }
	}
	return { globals: globals, tests: tests };
    }
    function parse_dict() {
	var result = {}
	while (i < lines.length && lines[i] != "!") {
	    var colon_loc = lines[i].indexOf(":");
	    if (colon_loc != -1) {
		var key = lines[i].slice(0, colon_loc);
		var value = lines[i].slice(colon_loc + 2);
		next();
		result[key] = decode(value);
	    } else {
		exclamation_loc = lines[i].indexOf("!");
		var key = lines[i].slice(0, exclamation_loc);
		next();
		result[key] = parse_array(key);
	    }
	}
	next();
	return result;
    }
    function parse_array() {
	var result = [];
	while (i < lines.length && lines[i] != "!") {
	    result.push(decode(lines[i].slice(1)));
	    next();
	}
	next();
	return result;
    }
    return parse_toplevel();
}

function load_summary(path) {
    var lines = get_file(path).split("\n");
    if (lines.length > 0 && lines[lines.length - 1] == "") {
	lines.pop();
    }
    return piglit_parse(lines);
}

function load_all_summaries() {
    all_data = {};
    var result_list = get_file("result-list.txt").split("\n");
    for (var i in result_list) {
	if (result_list[i] != "") {
	    all_data[result_list[i]] = load_summary("results/" + result_list[i] + "/summary");
	}
    }
}

function escape_html(str) {
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function escape_attr(str) {
    return escape_html(str).replace(/"/,"&quot;");
}

function stable_sort(data, classifier) {
    return Object.keys(data).sort(function(a, b) {
	var a_classification = classifier(data[a]);
	var b_classification = classifier(data[b]);
	if (a_classification < b_classification) return -1;
	if (a_classification > b_classification) return 1;
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
    }).map(function(i) { return data[i]; });
}

function display_result() {
    var id_num = 1;
    result_id_map = {};
    var result_name = $("#result_selector").val();
    var result_table = { skip: 2, warn: 1, pass: 1 };
    $("#result_name").text(result_name);
    var result_data = all_data[result_name].tests;
    var html = stable_sort(Object.keys(result_data).sort(), function(key) {
	return result_data[key].result || 0;
    }).map(function(key) {
	var result = result_data[key];
	var result_id = "result_" + id_num;
	id_num += 1;
	result_id_map[key] = result_id;
	return "<tr id=\"" + escape_attr(result_id) + "\"><td>" +
	    escape_html(String(result.result)) + "</td><td>" +
	    escape_html(key) + "</td></tr>";
    }).join("");
    $("#result_table_body").html(html);
    update_hiddenness();
}

function update_hiddenness() {
    var should_be_hidden;
    if (current_limit_regex == "") {
	should_be_hidden = function(key) { return false; };
    } else {
	try {
	    var current_limit_regex_matcher = new RegExp(current_limit_regex);
	} catch(e) {
	    $("#bad_regex_text").text(String(e));
	    alert(String(e));
	    return;
	}
	should_be_hidden = function(key) {
	    return !current_limit_regex_matcher.test(key);
	}
    }

    for (key in result_id_map) {
	$("#" + result_id_map[key]).toggleClass("hidden",
						should_be_hidden(key));
    }
}

function setup_result_selector()
{
    var html = Object.keys(all_data).sort().map(function(key) {
	return "<option value=\"" + escape_attr(key) + "\">" +
	    escape_html(key) + "</option>";
    }).join("");
    $("#result_selector").html(html);
    $("#result_selector").change(display_result);
}

function setup_limit_regex()
{
    current_limit_regex = "";
    function check_limit_regex() {
	var new_limit_regex = $("#limit_regex").val();
	if (new_limit_regex != current_limit_regex) {
	    current_limit_regex = new_limit_regex;
	    update_hiddenness();
	}
    }
    $("#limit_regex").change(check_limit_regex);
    $("#limit_regex").keypress(check_limit_regex);
    setInterval(check_limit_regex, 1000);
}

$(function() {
    load_all_summaries();
    setup_result_selector();
    setup_limit_regex();
    display_result();
});
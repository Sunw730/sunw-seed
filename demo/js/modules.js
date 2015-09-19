/**
 * Created by [Sun Wang] on 2015/9/16.
 */

Sunw.add("a", "", function(S) {
    return 3;
}).add("b", function(S) {
    return {b: 2};
}).add("c", ["a", "b"], function(S, a, b) {
    return a + b.b;
}).add("e", ["a"], function(S, a) {
    return a + 3;
}).add({name:"d", base:"../demo"}, "a, b", "css/d.css, js/d.js")
# sunw-seed
一款动态加载CSS和JS资源文件的脚本

# 脚本说明
使用脚本前需要先明白几个概念：
* 脚本：仅仅指CSS和JS文件。
* 工厂函数：类似于淘宝KISSY库中的模块函数，用来定义一个模块函数。
* 模块：模块分两种，一种是由一个或者多个脚本构成，另一种是不包脚本，仅通过一个工厂函数来定义.
* 配置：注册模块时可以自定义配置，使模块采用不同的策略进行加载.

目前sunw-seed提供的功能较为简单，主要提供以下方法：
* add:注册脚本及其依赖关系.
* use:使用（或者说是加载）指定的一个或者多个模块，加载完成后可以执行一个回调函数，同一个模块加载成功后不会重复加载.
* ready:可以设置DOM加载完成的回调函数，类似于jQuery.ready.
* 其他还提供了一系列工具方法，如：isFunction，isPlainObject，isArray，trim等等工具函数.

# 包含文件
脚本仅包含一个JS文件，并且没有任何依赖
```
sunw-seed/
└── dist/
    ├── sunw-seed_{version}.js
    └── sunw-seed_{version}.min.js
```

# 使用说明
# 1. 注册模块：
* 最简单的用法
```
Sunw.add("a", ["css/a.css", "js/a.js"])
```
其中"a"是模块名，["a.css", "a.js"]表示此模块包含一个a.css和a.js文件，其中脚本路径表示相对于seed脚本的路径，两个参数表示没有任何依赖
* add函数提供多种参数适配，以上代码等同于：
```
Sunw.add("a", "a.css,a.js");
```
```
Sunw.add("a", [], "a.css,a.js");
```
```
Sunw.add({name: "a"}, [], ["a.css", "a.js"]);
```
* 参数说明：
```
Sunw.add(
  {name: "a", base: "lib/a", timeout: 10000, async: true, version: "", charset: ""}, 
  ["b", "c"], 
  ["css/a.css", {async: false, version: "1.0", charset: "utf-8", url: "js/a.js"}]
);
```
name表示模块名；<br>
base表示模块目录（http(s)|ftp|/开头的路径表示绝对目录，其他表示相对于seed脚本的路径）；<br>
timeout表示此模块超时设置，默认10秒；<br>
async表示此模块脚本默认是否异步（也可以为单个脚本指定async|version|charset）；<br>
version模块版本号（版本号将以参数形式追加至脚本路径之后）；<br>
charset脚本加载时所用的编码。<br>
第二个参数表示依赖模块名称，如果依赖模块没有注册，则抛出异常

* 工厂函数：
```
Sunw.add("a", function(S) {
  var A = function() {
    this.name = "a";
  }
  return A;
}).add("b", ["a"], function(S, A) {
  var a = new A();
  var B = function() {
    this.parent = a.name;
    this.name = "b";
  }
  return B;
})
```
函数第一个参数是Sunw对象，之后参数为依赖模块函数返回值，如果依赖模块函数没有返回值或者依赖模块没有工厂函数（由脚本构成的模块），则该依赖模块返回值为undefined。

# 使用模块
```
Sunw.use(
  ["b", "c"], 
  function(S, B, C) {
    //指定模块b和c全部加载完成后执行的函数
  }
);
```
同add相同：函数第一个参数是Sunw对象，之后参数为依赖模块函数返回值<br>
use方法参数也做了适配，第一个参数可以是字符串类型，如下：
```
Sunw.use(
  "b, c",
  function(S, B, C) {
    //指定模块b和c全部加载完成后执行的函数
  }
);
```

# DOM回调
```
Sunw.ready(
  function(S) {
    //DOM加载完成后执行的函数
  }
);
```
类似于jQuery.ready函数



## Copyright

Copyright 2015 Sun Wang under [GNU GENERAL PUBLIC LICENSE Version 2, June 1991](LICENSE).

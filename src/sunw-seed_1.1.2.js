/**
 * Created by [Sun Wang] on 2015/9/15.
 * QQ:274072355
 * Email:sunwang_730@163.com
 */
(function (w, d, S, u) {

    //命名空间初始化
    S = w[S] = w[S] ? w[S] : function(selector) {
        if(/^#/.test(selector)) {
            return d.getElementById(selector.replace(/^#+/, ""))
        } else if(/^\./.test(selector)) {
            return d.getElementsByClassName(selector.replace(/^\.+/, ""))
        } else {
            return d.getElementsByTagName(selector)
        }
    };

    var version = "1.1.1",   //版本号
        /**
         * 消息定义
         * @type {{*}}
         */
        Msg = {
            ERROR_PARAM_TYPE: "param type is unsupported",
            ERROR_PARAM_NOT_EXISTS: "param [ ? ] does not exist",
            ERROR_MODULE_BLANK: "module name is blank",
            ERROR_MODULE_EXISTS: "module [ ? ] exists",
            ERROR_MODULE_NOT_EXISTS: "module [ ? ] does not exist",
            ERROR_MODULE_TIMEOUT: "module [ ? ] loaded timeout",
            ERROR_MODULE_LOAD_FAILED: "module [ ? ] load failed",
            ERROR_NODE_NOT_INIT: "node [ ? ] is not initialized",
            ERROR_NODE_LOAD_FAILED: "node [ ? ] load failed"
        },
        /**
         * 加载状态
         * @type {{*}}
         */
        State = {
            UNLOAD: 0,  //未加载
            ERROR: 1,   //加载错误
            TIMEOUT: 2, //加载超时
            LOADING: 3, //正在加载
            SUCCESS: 4  //加载成功
        },
        /**
         * 当前脚本所在目录
         */
        Base = (function () {
            var scripts = d.getElementsByTagName("script"),
                curScript = scripts[scripts.length - 1]
            return curScript.src.replace(/\?.*$/, "").replace(/\/[^\/]+\/*$/, "/");
        })(),

        isReady = false,    //DOM是否加载完成
        isReadyBind = false,    //是否绑定了DOM加载进度监听
        readyList = [],  //DOM加载完成的回调函数列表

        /**
         * 仿jquery.extend方法
         * 第一个参数为boolean类型时表示是否为深度复制
         * @returns {*}
         */
        extend = function () {
            var deep = false,
                start = 1,
                index = 0,
                target = u,
                _isPlainObject = function (val) {
                    return val && typeof val === "object" && val != w && !val.nodeType
                }
            if (typeof arguments[0] === "boolean") {
                deep = arguments[0],
                    start = 2,
                    index = 1;
            }
            for (; start < arguments.length; start++) {
                for (var i in arguments[start]) {
                    if (deep && _isPlainObject(arguments[index][i]) && _isPlainObject(arguments[start][i])) {
                        arguments[index][i] = extend.call(w, deep, arguments[index][i], arguments[start][i])
                    } else {
                        arguments[index][i] = arguments[start][i]
                    }
                }
            }
            return arguments[index]
        },

        Methods = {
            /**
             * 拼接URI
             * @returns {*}
             */
            _contactUri: function () {
                var result = arguments[0] || "";
                for (var i = 1, l = arguments.length; i < l; i++) {
                    if (!S.isBlank(arguments[i])) {
                        var sep = /^\?/.test(arguments[i]) ? "" : "/"
                        result = result.replace(/\/$/, "") + sep + arguments[i].replace(/^\//, "");
                    }
                }
                return result;
            },
            /**
             * 相对路径转化成绝对路径
             * @param base
             * @param path
             * @returns {*}
             */
            getPath: function (base, path) {
                if (S.isBlank(base) || /^\/|((http|https|ftp):\/\/)/.test(path)) return path;  //如果是绝对路径则直接返回
                while (true) {
                    if (/^(\.\/)+/.test(path)) {   //   ./ 开头
                        path = path.replace(/^(\.\/)+/, "");
                    } else if (/^\.\.\//.test(path)) {  //   ../ 开头
                        path = path.replace(/^\.\.\//, "");
                        base = base.replace(/\/[^\/]+\/*$/, "/");
                    } else {
                        return Methods._contactUri(base, path);
                    }
                }
            },
            /**
             * 获取所有要加载的模块
             * @param names {Array}
             */
            getLoadingModules: function (names) {
                var _modules = [],
                    _tmp = {},      //临时集合，用于模块去重
                    _add = function (_name) {
                        var _dependencies = S.getModuleDependencies(_name); //获取依赖
                        if (!(_name in _tmp)) {
                            _tmp[_name] = S.getModule(_name, true)._module;
                        }
                        for (var i = 0, l = _dependencies.length; i < l; i++) {
                            _add(_dependencies[i])  //解析依赖
                        }
                        return _tmp[_name]
                    }
                for (var i = 0, l = names.length; i < l; i++) {
                    _add(names[i])
                }
                //转为数组
                for (var _name in _tmp) {
                    _modules.push(_tmp[_name])
                }
                return _modules
            },
            /**
             * 异常
             * @param msg
             * @param param
             */
            error: function (msg, param) {
                throw msg.replace("?", param)
            },
            /**
             * 字符串转数组
             * @param value
             */
            toArray: function (value) {
                if (S.isString(value)) {
                    return S.isBlank(value) ? [] : S.trim(value).split(/\s*,\s*/)
                } else if (S.isArray(value)) {
                    return value;
                } else {
                    return Methods.error(Msg.ERROR_PARAM_TYPE)
                }
            }
        }

    /**
     * 基本属性
     */
    extend(S, {
        /**
         * 版本号
         */
        version: version,

        /**
         * 当前脚本路径
         */
        base: Base,

        /**
         * 默认配置
         */
        defaults: {
            base: "",       //模块主目录，相对于当前脚本路径
            timeout: 10000, //模块超时设置
            async: true,    //脚本是否异步加载
            charset: "",    //脚本编码设置
            version: ""     //模块版本号
        },

        /**
         * 模块加载状态
         */
        State: State,

        /**
         * 环境变量
         * S.Env：防止多次加载此脚本时引起Env被清空覆盖
         */
        Env: S.Env || {
            /**
             * 已注册模块，数据格式如下
             * {name:{ config:{ base:"", version:"", timeout:0 }, dependencies:[ "name1" ], factory:[{ async:true, charset:"", version:"", url:"" }] }, result:undefined }
             * or
             * {name:{ config:{ base:"", version:"", timeout:0 }, dependencies:[ "name1" ], factory:function() {} }, result:result }
             * ps:
             * name:模块名称
             * config:模块配置
             *      base:模块主目录
             *      version:模块版本号
             *      timeout:模块超时设置
             * dependencies:依赖模块名称列表
             * factory:模块内容，可以是JS或者CSS资源文件数组，也可以是一个工厂函数
             *      1.如果是JS或者CSS资源文件数组，数组中可以是string(表示url)，也可以是简单object（表示此资源文件配置）
             *          async:是否异步加载，如果设置为false，则此脚本加载完毕后才会加载数组后面的其他脚本
             *          charset:资源文件编码设置
             *          version:资源文件版本号，如果不设置，会使用所在模块的版本号
             *          url:资源文件路径
             *      2.如果是工厂函数，此函数在加载模块时执行，函数参数依次为S对象，依赖模块返回值列表
             *          例如：S.add("a", ["b", "c"], function(S, b, c) {})
             * result:模块返回值，如果模块内容是资源文件数组，则返回值为undefined，如果模块内容是工厂函数，则返回值为此函数返回值
             */
            modules: { },
            /**
             * 模块加载状态,见State全局变量
             */
            State: {
                //name: State.LOADING
            }
        }

    })

    /**
     * 扩展工具函数
     */
    extend(S, {
        /**
         * 继承
         */
        extend: extend,
        /**
         * 绑定事件
         */
        bind: function (ele, event, fn) {
            if (d.addEventListener) {
                ele.addEventListener(event, fn, false)
            } else {
                ele.attachEvent("on" + event, fn)
            }
            return S;
        },
        /**
         * 是否是一个字符串
         * @param value
         */
        isString: function (value) {
            return typeof value === "string"
        },
        /**
         * 是否是简单json对象
         * @param value
         * @returns {boolean}
         */
        isPlainObject: function (value) {
            return typeof value === "object" && value != w && !value.nodeType
        },
        /**
         * 是否是一个布尔类型值
         * @param value
         * @returns {boolean}
         */
        isBoolean: function (value) {
            return typeof value === "boolean"
        },
        /**
         * 是否是一个空白字符串
         * @param value
         */
        isBlank: function (value) {
            return value == null || (this.isString(value) && this.trim(value).length == 0)
        },
        /**
         * 是否是一个数组
         * @param value
         * @returns {boolean}
         */
        isArray: function (value) {
            return Array.isArray(value);
        },
        /**
         * 判断是否是一个函数
         * @param value
         * @returns {boolean}
         */
        isFunction: function (value) {
            return typeof value === "function"
        },
        /**
         * trim
         * @param value
         */
        trim: function (value) {
            if (this.isString(value)) {
                return value.replace("^\\s*|\\s*$", "")
            }
            return Methods.error(Msg.ERROR_PARAM_TYPE)
        }
    });

    /**
     * api接口
     */
    extend(S, {
        /**
         * 获取模块
         * @param name
         * @param thr 模块不存在时抛出异常
         * @returns {*}
         */
        getModule: function (name, thr) {
            var _module
            if (!S.isString(name)) return Methods.error(Msg.ERROR_PARAM_TYPE)
            _module = S.Env.modules[S.trim(name)];
            if (thr === true && !_module) return Methods.error(Msg.ERROR_MODULE_NOT_EXISTS, name)
            return _module
        },
        /**
         * 获取模块依赖
         * @param name
         * @returns {*}
         */
        getModuleDependencies: function (name) {
            var _module = S.getModule(name, true)
            return _module.dependencies;
        },
        /**
         * 获取模块状态
         * @param name
         * @returns {*}
         */
        getModuleState: function (name) {
            var _module = S.getModule(name, true)
            return S.Env.State[S.trim(name)];
        }
    })

    /**
     * DOM函数
     */
    extend(S, {
        /**
         * dom加载完成后触发
         * @param fn
         */
        ready: function (fn) {
            var _self = this
            if (!isReadyBind) _self._bindReady()
            if (isReady)
                fn.call(w, _self)
            else
                readyList.push(fn)
            return _self
        },
        /**
         * 绑定ready事件函数
         * @private
         */
        _bindReady: function () {
            var _self = this,
                doScroll = d.documentElement.doScroll,
                et = doScroll ? "onreadystatechange" : "DOMContentLoaded",
                complete = "complete",
                fire = function () {
                    _self._fireReady()
                }
            isReadyBind = true
            if (d.readyState === complete) return fire()
            if (d.addEventListener) {
                function domReady() {
                    d.removeEventListener(et, domReady, false), fire()
                }

                d.addEventListener(et, domReady, false)
                w.addEventListener("load", fire, false)
            } else {
                function stateChange() {
                    if (d.readyState === complete) {
                        d.detachEvent(et, stateChange)
                    }
                }

                d.attachEvent(et, stateChange)
                w.attachEvent("onload", fire)
                if (w === w.top) {
                    // Ref: http://javascript.nwbox.com/IEContentLoaded/
                    (function readyScroll() {
                        try {
                            doScroll("left"), fire()
                        } catch (e) {
                            setTimeout(readyScroll, 1)
                        }
                    })();
                }
            }
        },
        /**
         * 触发ready事件函数
         * @private
         */
        _fireReady: function () {
            if (isReady) return;
            isReady = true
            for (var i = 0, l = readyList.length; i < l; i++) {
                readyList[i].call(w, this)
            }
            readyList = []
        }

    });

    /**
     * 模块注册和加载
     */
    extend(S, {
        /**
         * 注册模块
         * @param name {string|object} 必需，{string}模块名称，{object}模块配置(见S.defaults)
         *      1.string类型：等同于 { "name": name }
         *      2.object类型：
         *          base:模块主目录
         *          timeout:模块超时设置
         *          async:模块中资源文件默认是否异步
         *          charset:模块中资源文件默认编码
         *          version:模块版本号
         * @param dependencies {string|Array} 可选，依赖模块名称列表
         *      1.string类型：等同于通过英文逗号“,”分隔成数组，例如："a, b ,c " 等同于 [ "a", "b", "c" ]，脚本自动去除空白
         *      2.object类型：名称列表，如： [ "a", "b", "c " ]，脚本自动去除空白
         * @param factory:模块内容，可以是JS或者CSS资源文件数组，也可以是一个工厂函数
         *      1.如果是JS或者CSS资源文件数组，数组中可以是string(表示url)，也可以是简单object（表示此资源文件配置）
         *          async:是否异步加载，如果设置为false，则此脚本加载完毕后才会加载数组后面的其他脚本
         *          charset:资源文件编码设置
         *          version:资源文件版本号，如果不设置，会使用所在模块的版本号
         *          url:资源文件路径
         *      2.如果是工厂函数，此函数在加载模块时执行，函数参数依次为S对象，依赖模块返回值列表
         *          例如：S.add("a", ["b", "c"], function(S, b, c) {})
         *
         */
        add: function (name, dependencies, factory) {
            var config, _base = ""
            //参数个数适配
            if (factory == u) {
                factory = dependencies, dependencies = [];
            }
            dependencies = Methods.toArray(dependencies);
            if (S.isString(factory)) {
                factory = Methods.toArray(factory)
            } else if(S.isPlainObject(factory)) {
                factory = [factory]
            }
            //参数类型检查
            if ((!S.isPlainObject(name) && !S.isString(name))
                || (!S.isFunction(factory) && !S.isArray(factory))) {
                return Methods.error(Msg.ERROR_PARAM_TYPE)
            }
            //参数类型适配
            if (S.isString(name)) {
                //该模块内节点加载默认配置项
                name = S.trim(name),
                    config = extend(true, {}, S.defaults)
            } else {
                if (!("name" in name)) return Methods.error(Msg.ERROR_PARAM_NOT_EXISTS, "name");
                config = extend(true, {}, S.defaults, name),
                    name = S.trim(name["name"]),
                    delete config.name
            }
            //模块绝对路径
            _base = Methods.getPath(Base, config.base);
            if (S.isArray(factory)) {
                for (var i = 0, l = factory.length; i < l; i++) {
                    if (S.isString(factory[i])) {
                        factory[i] = {url: factory[i]}
                    } else if (S.isPlainObject(factory[i])) {
                        if (!("url" in factory[i])) return Methods.error(Msg.ERROR_PARAM_NOT_EXISTS, "url");
                    } else {
                        return Methods.error(Msg.ERROR_PARAM_TYPE)
                    }
                    factory[i].url = Methods.getPath(_base, factory[i].url),
                        factory[i] = extend(true, {}, config, factory[i]);
                    delete factory[i].timeout,
                        delete factory[i].base
                }
            }
            //模块是否存在
            if (S.Env.modules[name]) return Methods.error(Msg.ERROR_MODULE_EXISTS, name)
            delete config.async,
                delete config.charset,
                delete config.url
            //注册模块
            S.Env.modules[name] = {
                config: config,
                dependencies: dependencies,
                factory: factory
            }
            S.Env.modules[name]._module = new Module(name)
            //状态初始化
            S.Env.State[name] = State.UNLOAD;
            return S
        },
        /**
         * 加载模块
         * @param names {string|Array(string)} 必须
         * @param fn
         * @returns {*}
         */
        use: function (names, fn) {
            var names = Methods.toArray(names),
            //_modules = Methods.getLoadingModules(names),    //依赖分析
                _fn = function () {
                    var _params = [S],
                        i = 0,
                        l = 0
                    for (i = 0, l = names.length; i < l; i++) {
                        if (S.getModuleState(names[i]) !== State.SUCCESS) return false;
                    }
                    //参数初始化
                    for (i = 0, l = names.length; i < l; i++) {
                        _params.push(S.getModule(names[i], true).result)
                    }
                    if(S.isFunction(fn)) fn.apply(w, _params)
                }
            for (var i = 0, l = names.length; i < l; i++) {
                S.getModule(names[i])._module.load(_fn);
            }
            return S;
        }
    })

    /**
     * 节点封装
     * @param config {url:"", async:true, charset:"", version:""}
     * @constructor
     */
    var Node = function (config) {
        var _self = this;
        extend(true, _self, config, {
            state: State.UNLOAD,           //加载状态
            callback: u,       //回调函数：参数为state
            autoLoad: false,       //true表示通过其他节点的回调函数自动加载，false表示通过调用load方法手动加载
            _dom: u,                //dom元素
            _subscribers: []         //订阅者，此节点加载完成后会通知订阅者开始自动加载
        })
        _self._init();  //初始化
    }
    extend(Node.prototype, {
        /**
         * 初始化
         * @private
         */
        _init: function () {
            var _self = this,
                _url = S.isBlank(_self.version) ? _self.url : (_self.url + (_self.url.indexOf("?") < 0 ? "?" : "&") + "v=" + _self.version),
                _isCss = /\.css\??.*$/i.test(_self.url),
            //封装回调函数
                _callback = function (state, S) {
                    if (S.isFunction(_self.callback)) _self.callback.call(_self, state, S)
                },
            //封装订阅者加载函数
                _loadSubscribers = function () {
                    for (var i = 0, l = _self._subscribers.length; i < l; i++) {
                        _self._subscribers[i].load.call(_self._subscribers[i], _self.callback)
                    }
                },
                _success = function () {
                    //改变状态
                    _self.state = State.SUCCESS;
                    //回调
                    _callback(true, S)
                    //订阅者加载
                    _loadSubscribers();
                },
                _error = function () {
                    //改变状态
                    _self.state = State.ERROR
                    //回调
                    _callback(false, S)
                    //订阅者加载
                    _loadSubscribers();
                }
            extend(true, _self, {
                _url: _url,
                _callback: _callback,
                _success: _success,
                _error: _error,
                _isCss: _isCss
            })
            //初始化dom
            if (_self._isCss) {
                _self._dom = d.createElement("link"),
                    extend(_self._dom, {
                        rel: "stylesheet",
                        href: _url,
                        type: "text/css"
                    })
            } else {
                _self._dom = d.createElement("script"),
                    extend(_self._dom, {
                        src: _url,
                        type: "text/javascript"
                    })
                if (S.isBoolean(_self.async)) _self._dom.async = _self.async;
            }
            if (!S.isBlank(_self.charset)) _self._dom.charset = _self.charset;
            //dom标签额外属性
            extend(true, _self._dom, _self.extra)
            //绑定事件
            S.bind(_self._dom, "load", _success).bind(_self._dom, "error", _error)
        },
        /**
         * 添加订阅者
         * @param subscribers
         * @returns {Node}
         */
        addSubscribers: function (subscribers) {
            var _self = this,
                _add = function (_subscriber) {
                    if (_subscriber instanceof Node) {
                        _self._subscribers.push(_subscriber),
                            _subscriber.autoLoad = true
                    }
                }
            if (S.isArray(subscribers)) {
                for (var i = 0, l = subscribers.length; i < l; i++) {
                    _add(subscribers[i])
                }
            } else {
                _add(subscribers)
            }
            return _self;
        },
        /**
         * 判断当前节点是否已经加载
         */
        canLoad: function() {
            var _self = this,
                _tagName = _self._isCss ? "link" : "script",
                _attr = _self._isCss ? "href" : "src",
                _nodes = d.getElementsByTagName(_tagName);
            if(_nodes && _nodes.length > 0) {
                for(var i = 0, l = _nodes.length; i < l; i++) {
                    if(_self._url == _nodes[i][_attr]) return false;
                }
            }
            return true;
        },
        /**
         * 开始加载
         * @returns {*}
         */
        load: function (fn) {
            var _self = this
            if (!_self._dom) return Methods.error(Msg.ERROR_NODE_NOT_INIT, _self.url)
            if(_self.canLoad() === false) {
                return _self._success
            }
            //开始加载
            _self.state = State.LOADING,
                _self.callback = fn,
                (d.head || d).appendChild(_self._dom)
        }
    })

    /**
     * 模块封装
     * @param name
     * @constructor
     */
    var Module = function (name) {
        var _self = this;
        extend(_self, S.Env.modules[name].config, {
            name: name,     //模块名称
            callback: [],    //回调函数
            _result: u,     //工厂函数返回结果
            _tid: u,        //超时设置
            _success: u,
            _error: u
        })
        _self._init();
    }
    extend(Module.prototype, {
        /**
         * 初始化
         * @private
         */
        _init: function () {
            var _self = this,
                _name = _self.name,
                _State = S.Env.State
            //回调函数初始化
            extend(_self, {
                _success: function () {
                    //清除定时器
                    if (_self._tid) clearTimeout(_self._tid)
                    //改变状态
                    _State[_name] = State.SUCCESS
                    //回调
                    _self._callback(true, S)
                },
                _error: function () {
                    //清除定时器
                    if (_self._tid) clearTimeout(_self._tid)
                    //改变状态
                    _State[_name] = State.ERROR
                    //回调
                    _self._callback(false, S)
                },
                /**
                 * 回调函数
                 * @param state
                 * @param S
                 * @private
                 */
                _callback: function(state, S) {
                    while(_self.callback.length > 0) {
                        if(S.isFunction(_self.callback[0])) {
                            _self.callback[0].call(_self, state, S);
                        }
                        _self.callback.shift()
                    }
                },
                /**
                 * 添加回调
                 * @param _fn
                 * @private
                 */
                _addCallback: function(_fn) {
                    if(S.isFunction(_fn)) {
                        _self.callback.push(_fn)
                    } else if(S.isArray(_fn)) {
                        for(var i = 0, l = _fn.length; i < l; i++) {
                            if(S.isFunction(_fn[i])) {
                                _self.callback.push(_fn[i])
                            }
                        }
                    }
                    return _self;
                }
            })
        },
        /**
         * 检查依赖是否加载完毕
         * @returns {boolean}
         */
        canLoad: function () {
            var _self = this,
                _name = _self.name,
                _dependencies = S.getModuleDependencies(_name);
            for (var i = 0, l = _dependencies.length; i < l; i++) {
                if (S.getModuleState(_dependencies[i]) !== State.SUCCESS) return false;
            }
            return true;
        },
        /**
         * 模块加载
         * @param fn
         * @returns {*}
         */
        load: function (fn) {
            var _self = this,
                _name = _self.name,     //模块名称
                _timeout = _self.timeout,   //模块超时设置
                _State = S.Env.State,   //所有模块状态
                _Modules = S.Env.modules,   //所有模块配置
                _module = _Modules[_name],  //当前模块配置
                _dependencies = _module.dependencies,   //当前模块依赖名称
                _factory = _module.factory, //当前模块定义
                _unSuccessDeps = [],    //当前模块还未加载成功的依赖（Module类型）
                _unSuccessDepsSet = {}, //当前模块还未加载成功的依赖集合，用于去重
                _fn = function() {
                    if(!_self.canLoad()) return false;
                    //开始加载
                    _State[_name] = State.LOADING;
                    //定时器
                    if (!isNaN(_timeout) && _timeout > 0) {
                        _self._tid = setTimeout(function () {
                            _State[_name] = State.TIMEOUT,
                                _self.callback = [] //清除回调
                            Methods.error(Msg.ERROR_MODULE_TIMEOUT, _name)
                        }, _timeout)
                    }
                    if (S.isFunction(_factory)) {
                        //对于工厂函数加载
                        return _self._loadFn(fn);
                    } else {
                        //节点加载
                        return _self._loadNodes(fn);
                    }
                }
            if(_State[_name] === State.SUCCESS) {
                //如果模块已经加载成功
                _self._addCallback(fn);
                return _self._callback(true, S);
            } else if(_State[_name] === State.LOADING) {
                //如果正在加载
                return _self._addCallback(fn)
            }
            //未完成依赖
            for(var i = 0, l = _dependencies.length; i < l; i++) {
                if(S.getModuleState(_dependencies[i]) !== State.SUCCESS) {
                    if(!(_dependencies[i] in _unSuccessDepsSet)) {
                        _unSuccessDepsSet[_dependencies[i]] = true;
                        _unSuccessDeps.push(_Modules[_dependencies[i]]._module)
                    }
                }
            }
            if(_unSuccessDeps.length > 0) {
                //先加载依赖
                for(var i = 0, l = _unSuccessDeps.length; i < l; i++) {
                    _unSuccessDeps[i].load(_fn)
                }
            } else {
                _fn()
            }
        },
        /**
         * 加载工厂函数
         * @private
         */
        _loadFn: function (fn) {
            var _self = this,
                _name = _self.name,
                _module = S.getModule(_name, true),
                _factory = _module.factory,
                _dependencies = _module.dependencies
            //设置回调函数
            _self._addCallback(fn);
            //对于工厂函数加载
            //获取工厂函数参数
            var _params = [S]
            for (var i = 0, l = _dependencies.length; i < l; i++) {
                _params.push(S.getModule(_dependencies[i], true).result)
            }
            //加载：实质是函数调用
            try {
                _module.result = _factory.apply(_self, _params);
                //加载成功
                _self._success();
            } catch (e) {
                _self._error();
                return Methods.error(Msg.ERROR_MODULE_LOAD_FAILED, _name)
            }
        },
        /**
         * 加载脚本节点
         * @private
         */
        _loadNodes: function (fn) {
            var _self = this,
                _name = _self.name,
                _Modules = S.Env.modules,
                _module = _Modules[_name],
                _factory = _module.factory,
                _nodes = [],
                _fn = function () {
                    var _state = true;  //模块加载成功与否，其中一个节点加载失败，则模块为失败状态
                    for (var i = 0, l = _nodes.length; i < l; i++) {
                        if (_nodes[i].state === State.ERROR) {
                            _state = false
                        } else if (_nodes[i].state !== State.SUCCESS) {
                            return false;
                        }
                    }
                    if (_state) {
                        _self._success()
                    } else {
                        _self._error()
                    }
                }
            //设置回调函数
            _self._addCallback(fn)
            //转成Node对象
            for (var i = 0, l = _factory.length; i < l; i++) {
                _nodes.push(new Node(_factory[i]))
            }
            for (var i = 0, l = _nodes.length; i < l; i++) {
                //订阅关系
                if (_nodes[i].async === false && i < l - 1) {
                    _nodes[i].addSubscribers(Array.prototype.slice.call(_nodes, i + 1))
                }
                //手动加载
                if (_nodes[i].autoLoad !== true) {
                    _nodes[i].load(_fn)
                }
            }
        }
    })

})(window, document, "Sunw")

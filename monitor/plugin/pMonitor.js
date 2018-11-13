const base = {
    log() {
    },
    logPackage() {
    },
    getLoadTime() {
    },
    getTimeoutRes() {
    },
    bindEvent() {
    },
    init() {
    }
};

const pm = (function () {
    // 向前兼容
    if (!window.performance) return base;
    const pMonitor = {...base};
    let config = {};

    // 出于简化考虑，定义 10s 为超时界限，那么获取超时资源的方法如下：
    const SEC = 1000;
    const TIMEOUT = 10 * SEC;
    const setTime = (limit = TIMEOUT) => time => time >= limit;
    const getLoadTime = ({startTime, responseEnd}) => responseEnd - startTime;
    const getName = ({name}) => name;

    // 因为获取数据之后，需要向服务端上报：
    // 生成表单数据
    const convert2FormData = (data) => {
        const formData = new FormData();
        Object.keys(data).forEach(key => formData.append(key, data[key]));
        return formData;
    };
    // 拼接 GET 时的url
    const makerItStr = (data = {}) => {
        Object.entries(data).map(([k, v]) => {
            `${k} = ${v}`
        }).join('&')
    };

    // 获取页面加载时间。
    pMonitor.getLoadTime = () => {
        const [{domComplete}] = performance.getEntriesByType('navigation');
        return domComplete
    };
    // 获取超时资源
    pMonitor.getTimeoutRes = (limit = TIMEOUT) => {
        const isTimeout = setTime(limit);
        const resourceTimes = performance.getEntriesByType('resource');
        return resourceTimes
            .filter(item => isTimeout(getLoadTime(item)))
            .map(getName);
    };
    // 获取各种时间
    pMonitor.getTimes = () => {
        var performance = window.performance;

        if (!performance) {
            // 当前浏览器不支持
            console.log('你的浏览器不支持 performance 接口');
            return;
        }

        var t = performance.timing;
        var times = {};

        //【重要】页面加载完成的时间
        //【原因】这几乎代表了用户等待页面可用的时间
        times.loadPage = t.loadEventEnd - t.navigationStart;

        //【重要】解析 DOM 树结构的时间
        //【原因】反省下你的 DOM 树嵌套是不是太多了！
        times.domReady = t.domComplete - t.responseEnd;

        //【重要】重定向的时间
        //【原因】拒绝重定向！比如，http://example.com/ 就不该写成 http://example.com
        times.redirect = t.redirectEnd - t.redirectStart;

        //【重要】DNS 查询时间
        //【原因】DNS 预加载做了么？页面内是不是使用了太多不同的域名导致域名查询的时间太长？
        // 可使用 HTML5 Prefetch 预查询 DNS ，见：[HTML5 prefetch](http://segmentfault.com/a/1190000000633364)
        times.lookupDomain = t.domainLookupEnd - t.domainLookupStart;

        //todo tcp
        // connectend-connectstart

        // dom准备时长
        // domloading-domIntericative

        //    白屏
        // domloading - nativatinStart

        //dom解析时间
        // domloading-domComplete


        //【重要】最初的网络请求被发起 到 从服务器接收到第一个字节 的时间
        //【原因】这可以理解为用户拿到你的资源占用的时间，加异地机房了么，加CDN 处理了么？加带宽了么？加 CPU 运算速度了么？
        // TTFB 即 Time To First Byte 的意思
        // 维基百科：https://en.wikipedia.org/wiki/Time_To_First_Byte
        times.ttfb = t.responseStart - t.navigationStart;

        //【重要】内容加载完成的时间
        //【原因】页面内容经过 gzip 压缩了么，静态资源 css/js 等压缩了么？
        times.request = t.responseEnd - t.requestStart;

        //【重要】执行 onload 回调函数的时间
        //【原因】是否太多不必要的操作都放到 onload 回调函数里执行了，考虑过延迟加载、按需加载的策略么？
        times.loadEvent = t.loadEventEnd - t.loadEventStart;

        // DNS 缓存时间
        times.appcache = t.domainLookupStart - t.fetchStart;

        // 卸载页面的时间
        times.unloadEvent = t.unloadEventEnd - t.unloadEventStart;

        // TCP 建立连接完成握手的时间
        times.connect = t.connectEnd - t.connectStart;

        return times;
    };

    // 上报数据
    pMonitor.log = (url, data = {}, type = 'POST') => {
        const method = type.toLowerCase();
        const urlToUse = method === 'get' ? `${url}?${makerItStr(data)}` : url;
        const body = method === 'get' ? {} : {body: convert2FormData(data)};
        const option = {
            method,
            ...body
        };
        console.log(option);
        fetch(urlToUse, option).catch(e => {
            console.log(e);
        });
    };

    // 封装一个上报两项核心数据的方法
    pMonitor.logPackage = () => {
        const {url, timeoutUrl, method} = config;
        // const domComplete = pMonitor.getLoadTime();
        const domComplete = pMonitor.getTimes();
        const timeoutRes = pMonitor.getTimeoutRes(config.timeout);
        // 上报页面加载啊时间
        console.log(domComplete);
        pMonitor.log(url, domComplete, method);

        if (timeoutRes.length) {
            pMonitor.log(
                timeoutUrl,
                {
                    timeoutRes
                },
                method
            )
        }
    };

    //性能监控只是辅助功能，不应阻塞页面加载，因此只有当页面完成加载后，我们才进行数据获取和上报
    // 事件绑定
    pMonitor.bindEvent = () => {
        const oldOnload = window.onload;
        window.onload = e => {
            if (oldOnload && typeof oldOnload === 'function') {
                oldOnload(e);
            }
            // 尽量不影响页面主线程
            if (window.requestIdleCallback) {
                window.requestIdleCallback(pMonitor.logPackage)
            } else {
                setTimeout(pMonitor.logPackage)
            }
        }
    };

    /**
     * 初始化
     * @param {object} option
     * @param {string} option.url 页面加载数据的上报地址
     * @param {string} option.timeoutUrl 页面资源超时的上报地址
     * @param {string=} [option.method='POST'] 请求方式
     * @param {number=} [option.timeout=10000]
     */
    pMonitor.init = option => {
        const {url, timeoutUrl, method = 'POST', timeout = 10000} = option;
        config = {
            url,
            timeoutUrl,
            method,
            timeout
        };
        // 绑定事件 用于触发上报数据
        pMonitor.bindEvent()
    };

    return pMonitor;
})();

export default pm;




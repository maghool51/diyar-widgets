(function () {
    "use strict";

    const BASE_URL =
        "https://maghool51.github.io/diyar-widgets/visitor/";

    function loadCSS() {

        if (document.querySelector(
            'link[data-diyar-css]'
        )) return;

        const css = document.createElement("link");

        css.rel = "stylesheet";
        css.href = BASE_URL + "visitor.css";
        css.dataset.diyarCss = "true";

        document.head.appendChild(css);
    }


    function loadScript(url, callback) {

        const script = document.createElement("script");

        script.src = url;
        script.onload = callback;

        document.body.appendChild(script);
    }


    function createMountPoint() {

        let el =
            document.getElementById(
                "diyar-visitor-widget"
            );

        if (!el) {

            el = document.createElement("div");

            el.id =
                "diyar-visitor-widget";

            document.currentScript
                .parentNode
                .insertBefore(
                    el,
                    document.currentScript
                );
        }

        return el;
    }


    function start() {

        createMountPoint();

        loadCSS();


        const files = [
            "config.js",
            "utils.js",
            "theme.js",
            "animations.js",
            "visitor.js"
        ];


        function next(index) {

            if (index >= files.length) {

                if (window.DiyarVisitor) {

                    window.DiyarVisitor.mount(
                        "#diyar-visitor-widget"
                    );

                }

                return;
            }


            loadScript(
                BASE_URL + files[index],
                function () {
                    next(index + 1);
                }
            );

        }


        next(0);

    }


    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            start
        );

    } else {

        start();

    }

})();

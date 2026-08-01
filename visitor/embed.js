(function () {
    "use strict";

    const BASE_URL =
        "https://maghool51.github.io/diyar-widgets/visitor/";

    function loadCSS() {

        if (document.getElementById("diyar-visitor-css"))
            return;

        const css = document.createElement("link");

        css.id = "diyar-visitor-css";
        css.rel = "stylesheet";
        css.href = BASE_URL + "visitor.css";

        document.head.appendChild(css);
    }


    function loadJS(src, callback) {

        const script = document.createElement("script");

        script.src = src;
        script.onload = callback;

        document.body.appendChild(script);
    }


    function createContainer() {

        let box =
            document.getElementById(
                "diyar-visitor-widget"
            );

        if (!box) {

            box = document.createElement("div");

            box.id =
                "diyar-visitor-widget";

            document.currentScript
                .parentNode
                .insertBefore(
                    box,
                    document.currentScript
                );
        }

    }


    function init() {

        loadCSS();

        createContainer();


        loadJS(
            BASE_URL + "config.js",
            function () {

                loadJS(
                    BASE_URL + "utils.js",
                    function () {

                        loadJS(
                            BASE_URL + "theme.js",
                            function () {

                                loadJS(
                                    BASE_URL + "animations.js",
                                    function () {

                                        loadJS(
                                            BASE_URL + "visitor.js"
                                        );

                                    }
                                );

                            }
                        );

                    }
                );

            }
        );

    }


    init();


})();

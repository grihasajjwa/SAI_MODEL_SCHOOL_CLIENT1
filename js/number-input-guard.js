(function () {
    /*
     * This file protects every <input type="number"> in the project.
     *
     * Browser number inputs can change when the user scrolls the mouse wheel
     * or presses ArrowUp / ArrowDown. That is risky for amount fields because
     * a value can change by mistake. These two listeners stop only that auto
     * increase/decrease behavior and keep normal typing allowed.
     */

    if (window.NumberInputGuard?.initialized) {
        return;
    }

    function isProtectedNumberInput(element) {
        return element?.matches?.('input[type="number"]:not([data-allow-number-spin="true"])');
    }

    function blockNumberWheel(event) {
        if (isProtectedNumberInput(event.target)) {
            event.preventDefault();
        }
    }

    function blockNumberArrowKeys(event) {
        if (isProtectedNumberInput(event.target) && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
            event.preventDefault();
        }
    }

    document.addEventListener('wheel', blockNumberWheel, { passive: false, capture: true });
    document.addEventListener('keydown', blockNumberArrowKeys, true);

    window.NumberInputGuard = {
        initialized: true
    };
})();

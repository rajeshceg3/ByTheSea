(function() {
    // Failsafe: Remove loading curtain if it takes too long (e.g. app crash)
    setTimeout(function() {
        var curtain = document.getElementById('curtain');
        if (curtain && !curtain.classList.contains('hidden')) {
            console.warn('Failsafe triggered: Removing loading curtain.');
            curtain.classList.add('hidden');
        }
    }, 5000); // 5 seconds max wait
})();

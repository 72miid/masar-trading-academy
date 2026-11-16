(() => {
  "use strict";

  function isUnlocked(index, completed, unitCount) {
    if (!Number.isInteger(index) || index < 0 || index >= unitCount || !Array.isArray(completed)) return false;
    for (let prerequisite = 0; prerequisite < index; prerequisite++) {
      if (!completed.includes(prerequisite)) return false;
    }
    return true;
  }

  function isPassingScore(score, questionCount = 5, requiredCorrect = 4) {
    return Number.isInteger(score) && Number.isInteger(questionCount) && Number.isInteger(requiredCorrect)
      && questionCount > 0 && requiredCorrect >= 0 && requiredCorrect <= questionCount
      && score >= requiredCorrect && score <= questionCount;
  }

  window.MASARUnitAccess = { isUnlocked, isPassingScore };
})();

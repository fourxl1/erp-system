function calculateAverageCost(totalPurchaseValue, totalQuantityPurchased) {
  const quantity = Number(totalQuantityPurchased || 0);
  const total = Number(totalPurchaseValue || 0);

  if (!quantity) {
    return 0;
  }

  return total / quantity;
}

module.exports = {
  calculateAverageCost
};

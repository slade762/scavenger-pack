// Wallet: holds any number of coupons as a balance (Slade).
StartupEvents.registry('item', event => {
  event.create('wallet')
    .displayName('Wallet')
    .maxStackSize(1)
    .tooltip(Text.gray('Right-click: put your coupons and Coupon Packs in'))
    .tooltip(Text.gray('Sneak + right-click: take out a Coupon Pack (50)'))
})

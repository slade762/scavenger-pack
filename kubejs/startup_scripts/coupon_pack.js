// Coupon Pack: a bundle worth 50 Into The Zone coupons.
// CustomNPCs trades can only ask for two stacks (max 128 coupons), so bigger prices use packs.
// The Scavengers trader swaps 50 coupons <-> 1 pack.
StartupEvents.registry('item', event => {
  event.create('coupon_pack')
    .displayName('Coupon Pack')
    .tooltip(Text.gray('Worth 50 coupons'))
    .maxStackSize(64)
})

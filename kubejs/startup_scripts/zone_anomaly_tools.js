// zone_anomaly_tools.js (startup, Ward 11/25 note 6): two kits for clearing Anomaly Zone anomalies.
// Hold right-click next to an anomaly (within 5 blocks). The work is done by server script zone_anomaly_neutralise.js.
StartupEvents.registry('item', event => {
  event.create('anomaly_neutraliser')
    .displayName('Anomaly Neutraliser')
    .maxStackSize(16)
    .useAnimation('bow')
    .useDuration(itemstack => 60)
    .use((level, player, hand) => true)
    .finishUsing((itemstack, level, entity) => {
      if (!level.isClientSide() && global.zoneAnomalyTool) global.zoneAnomalyTool(entity, itemstack, false)
      return itemstack
    })
    .tooltip(Text.gray('Hold right-click within 5 blocks of an anomaly to collapse it.'))
    .tooltip(Text.darkGray('The anomaly reforms after the next Emission.'))
  event.create('anomaly_stabiliser')
    .displayName('Anomaly Stabiliser')
    .maxStackSize(16)
    .rarity('rare')
    .useAnimation('bow')
    .useDuration(itemstack => 100)
    .use((level, player, hand) => true)
    .finishUsing((itemstack, level, entity) => {
      if (!level.isClientSide() && global.zoneAnomalyTool) global.zoneAnomalyTool(entity, itemstack, true)
      return itemstack
    })
    .tooltip(Text.gray('Hold right-click within 5 blocks of an anomaly to remove it for good.'))
    .tooltip(Text.darkGray('For anomalies that drifted into your camp or build.'))
})

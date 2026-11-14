const {supabaseRest}=require('./_lib');
async function exact(table,query){
 const result=await supabaseRest(table,{method:'HEAD',query,prefer:'count=exact'});
 if(!result.ok||!Number.isSafeInteger(result.count)||result.count<0)throw Error('Impact counts unavailable');
 return result.count;
}
async function impactSummary(){
 const external='select=id,playfeed_analytics_devices!inner(is_owner)&playfeed_analytics_devices.is_owner=eq.false&is_bot=eq.false&action=';
 const results=await Promise.allSettled([
  exact('playfeed_analytics_events',external+'in.(save_success,guest_save_success)'),
  exact('playfeed_analytics_events',external+'eq.share_success'),
 ]);
 return Object.fromEntries(['externalSaves','externalShares'].map((key,index)=>[key,results[index].status==='fulfilled'?results[index].value:null]));
}
module.exports={impactSummary};

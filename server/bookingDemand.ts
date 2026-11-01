export type BookingDemandRecord = { date:string; startMinutes:number; status:string };
export type BookingDemand = { sampleSize:number; cancelledBookings:number; days:Array<{weekday:number;bookings:number;cancelled:number}>; hours:Array<{hour:number;bookings:number}> };
export function buildBookingDemand(records:BookingDemandRecord[]):BookingDemand {
 const days=Array.from({length:7},(_,weekday)=>({weekday,bookings:0,cancelled:0}));
 const hours=new Map<number,number>(); let sampleSize=0; let cancelledBookings=0;
 for(const record of records){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(record.date)||!Number.isInteger(record.startMinutes)||record.startMinutes<0||record.startMinutes>1439) continue;
  const date=new Date(record.date+"T00:00:00.000Z");
  if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==record.date) continue;
  const weekday=date.getUTCDay(); const hour=Math.floor(record.startMinutes/60);
  if(record.status==="cancelled"){days[weekday].cancelled++;cancelledBookings++;continue;}
  days[weekday].bookings++;hours.set(hour,(hours.get(hour)??0)+1);sampleSize++;
 }
 return {sampleSize,cancelledBookings,days,hours:[...hours.entries()].sort(([a],[b])=>a-b).map(([hour,bookings])=>({hour,bookings}))};
}

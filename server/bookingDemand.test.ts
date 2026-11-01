import {describe,expect,it} from "vitest";
import {buildBookingDemand} from "./bookingDemand";
describe("buildBookingDemand",()=>{
 it("groups bookings by tenant-local weekday and start hour",()=>{
  const r=buildBookingDemand([{date:"2026-11-02",startMinutes:555,status:"confirmed"},{date:"2026-11-02",startMinutes:585,status:"completed"},{date:"2026-11-03",startMinutes:840,status:"arrived"}]);
  expect(r.sampleSize).toBe(3);expect(r.days[1].bookings).toBe(2);expect(r.days[2].bookings).toBe(1);expect(r.hours).toEqual([{hour:9,bookings:2},{hour:14,bookings:1}]);
 });
 it("keeps cancellations separate from demand",()=>{
  const r=buildBookingDemand([{date:"2026-11-02",startMinutes:600,status:"cancelled"},{date:"2026-11-02",startMinutes:660,status:"no_show"}]);
  expect(r.sampleSize).toBe(1);expect(r.cancelledBookings).toBe(1);expect(r.days[1]).toEqual({weekday:1,bookings:1,cancelled:1});
 });
 it("ignores invalid dates and times",()=>{
  const r=buildBookingDemand([{date:"2026-02-30",startMinutes:600,status:"confirmed"},{date:"2026-11-02",startMinutes:1440,status:"confirmed"}]);
  expect(r.sampleSize).toBe(0);expect(r.hours).toEqual([]);
 });
});

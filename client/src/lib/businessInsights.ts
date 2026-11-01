export type BusinessInsightInput = {
  bookings: number;
  completed: number;
  cancelled: number;
  revenue: number;
  paidRevenue: number;
  expenseTotal: number;
  employees: Array<{ id: number; name: string; revenue: number; noShow: number }>;
};

export type BusinessInsight = {
  priority: "high" | "medium" | "info";
  title: string;
  detail: string;
  action: string;
};

export function buildBusinessInsights(input: BusinessInsightInput) {
  const noShowCount = input.employees.reduce((sum, employee) => sum + employee.noShow, 0);
  const unpaid = Math.max(0, input.revenue - input.paidRevenue);
  const net = input.revenue - input.expenseTotal;
  const noShowRate = input.bookings > 0 ? noShowCount / input.bookings : 0;
  const cancellationRate = input.bookings > 0 ? input.cancelled / input.bookings : 0;
  const topEmployee = [...input.employees].sort((a, b) => b.revenue - a.revenue)[0];
  const recommendations: BusinessInsight[] = [];

  if (input.bookings === 0) {
    recommendations.push({
      priority: "info",
      title: "ابدأ بجمع بيانات التشغيل",
      detail: "لا توجد حجوزات في الفترة المحددة؛ ستظهر المؤشرات والتوصيات بمجرد تسجيل النشاط الفعلي.",
      action: "راجع رابط الحجز وتأكد من نشر الخدمات ومواعيد الفريق.",
    });
  } else {
    if (unpaid > 0) recommendations.push({
      priority: unpaid > input.revenue * 0.2 ? "high" : "medium",
      title: "هناك مبالغ لم تُحصّل بعد",
      detail: `المبالغ المسجلة كإيراد وغير المسددة تبلغ ${unpaid.toLocaleString()} من عملة النشاط.`,
      action: "راجع الحجوزات غير المدفوعة وطابقها مع الصندوق قبل إغلاق اليوم.",
    });
    if (noShowRate >= 0.1) recommendations.push({
      priority: noShowRate >= 0.2 ? "high" : "medium",
      title: "معدل عدم الحضور يحتاج متابعة",
      detail: `${noShowCount} من ${input.bookings} حجزاً مسجلاً انتهى كعدم حضور (${Math.round(noShowRate * 100)}%).`,
      action: "اختبر تأكيد الحجز قبل الموعد وقائمة انتظار لملء الفترات التي تُلغى.",
    });
    if (cancellationRate >= 0.15) recommendations.push({
      priority: "medium",
      title: "الإلغاءات أعلى من المستوى المستهدف",
      detail: `${Math.round(cancellationRate * 100)}% من الحجوزات في الفترة أُلغيت.`,
      action: "راجع أوقات الذروة وأسباب الإلغاء قبل تعديل سياسة الحجز.",
    });
    if (input.expenseTotal > input.revenue) recommendations.push({
      priority: "high",
      title: "المصروفات تتجاوز إيراد الحجوزات",
      detail: "المصروفات المسجلة أعلى من إيراد الحجوزات في الفترة؛ هذا مؤشر تشغيلي وليس كشفاً محاسبياً نهائياً.",
      action: "راجع المصروفات والتكاليف غير المسجلة في الإيراد قبل اتخاذ قرار مالي.",
    });
    if (topEmployee && topEmployee.revenue > 0) recommendations.push({
      priority: "info",
      title: "أعلى مساهمة في الإيراد",
      detail: `${topEmployee.name} سجّل أعلى إيراد حجوزات بين الموظفين خلال الفترة.`,
      action: "قارن نوع الخدمات وساعات العمل وتقييمات العملاء لفهم سبب الأداء.",
    });
    if (!recommendations.length) recommendations.push({
      priority: "info",
      title: "لا توجد إشارات تستدعي التنبيه حالياً",
      detail: "المؤشرات المتاحة لا تُظهر تجاوزات وفق قواعد التنبيه الحالية.",
      action: "تابع المؤشرات أسبوعياً؛ التوصيات مبنية على البيانات المسجلة فقط.",
    });
  }

  return {
    noShowCount,
    noShowRate,
    unpaid,
    net,
    recommendations,
  };
}

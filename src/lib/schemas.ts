import { z } from "zod";

export const createBookingSchema = z.object({
  title: z.string().trim().min(1, "กรุณาระบุหัวข้อการประชุม").max(200),
  startTime: z.string().datetime({ message: "รูปแบบเวลาเริ่มไม่ถูกต้อง" }),
  endTime: z.string().datetime({ message: "รูปแบบเวลาสิ้นสุดไม่ถูกต้อง" }),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

import type { NextApiRequest, NextApiResponse } from "next";

import prisma from "@calcom/prisma";

import { withMiddleware } from "@lib/helpers/withMiddleware";
import { BookingReferenceResponse, BookingReferencesResponse } from "@lib/types";
import {
  schemaBookingCreateBodyParams,
  schemaBookingReferenceReadPublic,
} from "@lib/validations/booking-reference";

async function createOrlistAllBookingReferences(
  { method, userId }: NextApiRequest,
  res: NextApiResponse<BookingReferencesResponse | BookingReferenceResponse>
) {
  const userWithBookings = await prisma.user.findUnique({
    where: { id: userId },
    include: { bookings: true },
  });
  if (!userWithBookings) throw new Error("User not found");
  const userBookingIds = userWithBookings.bookings.map((booking: any) => booking.id).flat();
  if (method === "GET") {
    /**
     * @swagger
     * /booking-references:
     *   get:
     *     summary: Find all booking references
     *     tags:
     *     - booking-references
     *     responses:
     *       200:
     *         description: OK
     *       401:
     *        description: Authorization information is missing or invalid.
     *       404:
     *         description: No booking references were found
     */
    const data = await prisma.bookingReference.findMany({ where: { id: { in: userBookingIds } } });
    const booking_references = data.map((bookingReference) =>
      schemaBookingReferenceReadPublic.parse(bookingReference)
    );
    if (booking_references) res.status(200).json({ booking_references });
    else
      (error: Error) =>
        res.status(404).json({
          message: "No BookingReferences were found",
          error,
        });
  } else if (method === "POST") {
    /**
     * @swagger
     * /booking-references:
     *   post:
     *     summary: Creates a new  booking reference
     *     tags:
     *     - booking-references
     *     responses:
     *       201:
     *         description: OK,  booking reference created
     *       400:
     *        description: Bad request. BookingReference body is invalid.
     *       401:
     *        description: Authorization information is missing or invalid.
     */
    const safe = schemaBookingCreateBodyParams.safeParse(req.body);
    if (!safe.success) {
      throw new Error("Invalid request body");
    }

    // const booking_reference = schemaBookingReferencePublic.parse(data);
    const userId = req.userId;
    const userWithBookings = await prisma.user.findUnique({
      where: { id: userId },
      include: { bookings: true },
    });
    if (!userWithBookings) {
      throw new Error("User not found");
    }
    const userBookingIds = userWithBookings.bookings.map((booking: any) => booking.id).flat();
    if (!userBookingIds.includes(safe.data.bookingId)) res.status(401).json({ message: "Unauthorized" });
    else {
      const booking_reference = await prisma.bookingReference.create({
        data: { ...safe.data },
      });
      if (booking_reference) {
        res.status(201).json({
          booking_reference,
          message: "BookingReference created successfully",
        });
      } else {
        (error: Error) =>
          res.status(400).json({
            message: "Could not create new booking reference",
            error,
          });
      }
    }
  } else res.status(405).json({ message: `Method ${method} not allowed` });
}

export default withMiddleware("HTTP_GET_OR_POST")(createOrlistAllBookingReferences);

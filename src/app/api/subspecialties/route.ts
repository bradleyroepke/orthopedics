import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { VALID_SUBSPECIALTIES } from "@/lib/utils";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const counts = await prisma.document.groupBy({
    by: ["subspecialty"],
    _count: {
      subspecialty: true,
    },
    orderBy: {
      subspecialty: "asc",
    },
  });

  const subspecialties = VALID_SUBSPECIALTIES.map((sub) => {
    const count = counts.find((c) => c.subspecialty === sub);
    return {
      name: sub,
      count: count?._count.subspecialty || 0,
    };
  });

  const totalDocuments = counts.reduce(
    (sum, c) => sum + c._count.subspecialty,
    0
  );

  return NextResponse.json({
    subspecialties,
    totalDocuments,
  });
}

import { and, asc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  bookingEvents,
  bookings,
  conditionConfirmations,
  conditionEntries,
  conditionReports,
  contractAcceptances,
  contracts,
  conversationParticipants,
  conversations,
  disputeEvents,
  disputeProposals,
  disputes,
  giveawayClaims,
  legalAcceptances,
  legalDocumentVersions,
  listingImages,
  listings,
  localities,
  messages,
  notifications,
  reports,
  reviews,
  savedListings,
  userBlocks,
  userProfiles,
  users,
} from "@/db/schema";
import { recordAudit } from "@/modules/audit/audit";
import type { Actor } from "@/modules/authz/actor-types";
import { assertCan } from "@/modules/authz/policy";
import { enforceRateLimits, type RateRule } from "@/modules/ratelimit/ratelimit";
import { getRequestMeta } from "@/modules/server/request-meta";

/** «Last ned mine data» (P03-06, PRIVACY §8): at most five files a day. */
export const EXPORT_LIMIT: RateRule = { max: 5, windowSeconds: 24 * 60 * 60 };

const period = {
  start: sql<Date>`lower(${bookings.period})`.mapWith((v) => new Date(v as string)),
  end: sql<Date>`upper(${bookings.period})`.mapWith((v) => new Date(v as string)),
};

/**
 * Everything Laandet holds about the person, as one JSON document. Never another person's email or
 * messages, never staff-only notes, never a sealed review about the person, never IP hashes.
 */
export async function buildDataExport(actor: Actor, now = new Date()) {
  assertCan(actor, "account.export");
  const me = actor.id;
  await enforceRateLimits(db, [{ bucket: `export:user:${me}`, rule: EXPORT_LIMIT }]);

  const [account] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      status: userProfiles.status,
      role: userProfiles.role,
      locale: userProfiles.locale,
      bio: userProfiles.bio,
      locality: localities.name,
      emailNotifications: userProfiles.emailNotifications,
      age18ConfirmedAt: userProfiles.age18ConfirmedAt,
      privateUseConfirmedAt: userProfiles.privateUseConfirmedAt,
      deletionRequestedAt: userProfiles.deletionRequestedAt,
    })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .leftJoin(localities, eq(localities.id, userProfiles.localityId))
    .where(eq(users.id, me));

  const acceptances = await db
    .select({
      document: legalDocumentVersions.docKey,
      version: legalDocumentVersions.version,
      locale: legalDocumentVersions.locale,
      acceptedAt: legalAcceptances.acceptedAt,
    })
    .from(legalAcceptances)
    .innerJoin(legalDocumentVersions, eq(legalDocumentVersions.id, legalAcceptances.documentVersionId))
    .where(eq(legalAcceptances.userId, me))
    .orderBy(asc(legalAcceptances.acceptedAt));

  const ownListings = await db.select().from(listings).where(eq(listings.ownerId, me)).orderBy(asc(listings.createdAt));
  const images = ownListings.length
    ? await db
        .select({ listingId: listingImages.listingId, mediaId: listingImages.mediaId, altText: listingImages.altText })
        .from(listingImages)
        .where(
          inArray(
            listingImages.listingId,
            ownListings.map((l) => l.id),
          ),
        )
    : [];

  const saved = await db
    .select({ listingId: savedListings.listingId, createdAt: savedListings.createdAt })
    .from(savedListings)
    .where(eq(savedListings.userId, me));
  const blocks = await db
    .select({ blockedUserId: userBlocks.blockedId, createdAt: userBlocks.createdAt })
    .from(userBlocks)
    .where(eq(userBlocks.blockerId, me));

  // Conversations the person takes part in, with only their own messages.
  const convs = await db
    .select({ id: conversations.id, listingId: conversations.listingId, createdAt: conversations.createdAt })
    .from(conversations)
    .innerJoin(conversationParticipants, eq(conversationParticipants.conversationId, conversations.id))
    .where(eq(conversationParticipants.userId, me));
  const myMessages = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(and(eq(messages.senderId, me), eq(messages.kind, "user")))
    .orderBy(asc(messages.createdAt));

  // Rentals as owner or renter: terms, history, agreements, own condition entries and confirmations.
  const myBookings = await db
    .select({ b: bookings, title: listings.title, ...period })
    .from(bookings)
    .innerJoin(listings, eq(listings.id, bookings.listingId))
    .where(or(eq(bookings.ownerId, me), eq(bookings.renterId, me)))
    .orderBy(asc(bookings.createdAt));
  const bookingIds = myBookings.map((r) => r.b.id);
  const [events, bookingContracts, reportsOfBookings] = bookingIds.length
    ? await Promise.all([
        db
          .select()
          .from(bookingEvents)
          .where(inArray(bookingEvents.bookingId, bookingIds))
          .orderBy(asc(bookingEvents.createdAt)),
        db.select().from(contracts).where(inArray(contracts.bookingId, bookingIds)).orderBy(asc(contracts.revision)),
        db.select().from(conditionReports).where(inArray(conditionReports.bookingId, bookingIds)),
      ])
    : [[], [], []];
  const reportIds = reportsOfBookings.map((r) => r.id);
  const [myEntries, myConfirmations] = reportIds.length
    ? await Promise.all([
        db
          .select()
          .from(conditionEntries)
          .where(and(inArray(conditionEntries.reportId, reportIds), eq(conditionEntries.authorId, me)))
          .orderBy(asc(conditionEntries.createdAt)),
        db
          .select()
          .from(conditionConfirmations)
          .where(and(inArray(conditionConfirmations.reportId, reportIds), eq(conditionConfirmations.userId, me)))
          .orderBy(asc(conditionConfirmations.createdAt)),
      ])
    : [[], []];

  const myClaims = await db
    .select({ g: giveawayClaims, title: listings.title })
    .from(giveawayClaims)
    .innerJoin(listings, eq(listings.id, giveawayClaims.listingId))
    .where(or(eq(giveawayClaims.giverId, me), eq(giveawayClaims.claimantId, me)))
    .orderBy(asc(giveawayClaims.createdAt));
  const claimContracts = myClaims.length
    ? await db
        .select()
        .from(contracts)
        .where(
          inArray(
            contracts.giveawayClaimId,
            myClaims.map((c) => c.g.id),
          ),
        )
    : [];
  const allContractIds = [...bookingContracts, ...claimContracts].map((c) => c.id);
  const myAcceptances = allContractIds.length
    ? await db
        .select()
        .from(contractAcceptances)
        .where(and(inArray(contractAcceptances.contractId, allContractIds), eq(contractAcceptances.userId, me)))
    : [];
  const accepted = (contractId: string) => myAcceptances.find((a) => a.contractId === contractId)?.acceptedAt ?? null;
  const agreement = (c: typeof contracts.$inferSelect) => ({
    agreementNumber: c.agreementNumber,
    revision: c.revision,
    status: c.status,
    text: c.renderedText,
    sha256: c.renderedSha256,
    createdAt: c.createdAt,
    acceptedByYouAt: accepted(c.id),
  });

  // Reviews: everything the person wrote; about them, only what is published.
  const written = await db.select().from(reviews).where(eq(reviews.authorId, me));
  const received = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.subjectId, me), eq(reviews.status, "published")));
  const review = (r: typeof reviews.$inferSelect) => ({
    bookingId: r.bookingId,
    status: r.status,
    communication: r.ratingCommunication,
    punctuality: r.ratingPunctuality,
    accuracy: r.ratingAccuracy,
    itemCondition: r.ratingItemCondition,
    agreement: r.ratingAgreement,
    comment: r.comment,
    createdAt: r.createdAt,
    publishedAt: r.publishedAt,
  });

  const filed = await db
    .select({
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      details: reports.details,
      status: reports.status,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.reporterId, me));

  // Cases: what the parties can see (never `staff_only` notes).
  const myDisputes = await db
    .select()
    .from(disputes)
    .where(or(eq(disputes.openedBy, me), eq(disputes.respondentId, me)));
  const disputeIds = myDisputes.map((d) => d.id);
  const [caseEvents, proposals] = disputeIds.length
    ? await Promise.all([
        db
          .select()
          .from(disputeEvents)
          .where(and(inArray(disputeEvents.disputeId, disputeIds), ne(disputeEvents.visibility, "staff_only")))
          .orderBy(asc(disputeEvents.createdAt)),
        db
          .select()
          .from(disputeProposals)
          .where(inArray(disputeProposals.disputeId, disputeIds))
          .orderBy(asc(disputeProposals.createdAt)),
      ])
    : [[], []];

  const notices = await db
    .select({
      type: notifications.type,
      payload: notifications.payload,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, me))
    .orderBy(asc(notifications.createdAt));

  await recordAudit(db, {
    actorId: me,
    action: "user.data_export",
    targetType: "user",
    targetId: me,
    meta: await getRequestMeta(),
  });

  return {
    format: "laandet-data-export-1",
    exportedAt: now.toISOString(),
    account: account ?? null,
    legalAcceptances: acceptances,
    listings: ownListings.map((l) => ({
      id: l.id,
      type: l.type,
      status: l.status,
      title: l.title,
      description: l.description,
      areaNote: l.areaNote,
      itemCondition: l.itemCondition,
      knownDefects: l.knownDefects,
      priceOre: l.priceOre,
      priceUnit: l.priceUnit,
      declaredValueOre: l.declaredValueOre,
      depositOre: l.depositOre,
      usageRestrictions: l.usageRestrictions,
      includedAccessories: l.includedAccessories,
      operatingInstructions: l.operatingInstructions,
      createdAt: l.createdAt,
      publishedAt: l.publishedAt,
      deletedAt: l.deletedAt,
      images: images.filter((i) => i.listingId === l.id).map((i) => ({ mediaId: i.mediaId, altText: i.altText })),
    })),
    savedListings: saved,
    blockedUsers: blocks,
    conversations: convs.map((c) => ({
      ...c,
      yourMessages: myMessages
        .filter((m) => m.conversationId === c.id)
        .map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt })),
    })),
    rentals: myBookings.map(({ b, title, start, end }) => ({
      id: b.id,
      yourRole: b.ownerId === me ? "owner" : "renter",
      listingTitle: title,
      status: b.status,
      start,
      end,
      priceOre: b.priceOre,
      priceUnit: b.priceUnit,
      units: b.units,
      totalPriceOre: b.totalPriceOre,
      depositOre: b.depositOre,
      declaredValueOre: b.declaredValueOre,
      handoverMethod: b.handoverMethod,
      returnMethod: b.returnMethod,
      deliveryFeeOre: b.deliveryFeeOre,
      meetingPlace: b.meetingPlacePrivate,
      createdAt: b.createdAt,
      completedAt: b.completedAt,
      cancelledAt: b.cancelledAt,
      cancelReason: b.cancelReason,
      history: events
        .filter((e) => e.bookingId === b.id)
        .map((e) => ({
          event: e.event,
          from: e.fromStatus,
          to: e.toStatus,
          at: e.createdAt,
          by: e.actorId === null ? "system" : e.actorId === me ? "you" : "other_party",
        })),
      agreements: bookingContracts.filter((c) => c.bookingId === b.id).map(agreement),
      yourConditionEntries: myEntries
        .filter((e) => reportsOfBookings.some((r) => r.id === e.reportId && r.bookingId === b.id))
        .map((e) => ({
          phase: reportsOfBookings.find((r) => r.id === e.reportId)!.phase,
          version: e.seq,
          overallCondition: e.overallCondition,
          functionalStatus: e.functionalStatus,
          existingDamage: e.existingDamage,
          newDamage: e.newDamage,
          accessories: e.accessories,
          fuelOrBattery: e.fuelOrBattery,
          cleanliness: e.cleanliness,
          serialOrIdentifier: e.serialOrIdentifier,
          proposedOutcome: e.proposedOutcome,
          notes: e.notes,
          createdAt: e.createdAt,
        })),
      yourConditionConfirmations: myConfirmations
        .filter((c) => reportsOfBookings.some((r) => r.id === c.reportId && r.bookingId === b.id))
        .map((c) => ({ decision: c.decision, comment: c.comment, version: c.latestEntrySeq, createdAt: c.createdAt })),
    })),
    giveaways: myClaims.map(({ g, title }) => ({
      id: g.id,
      yourRole: g.giverId === me ? "giver" : "recipient",
      listingTitle: title,
      status: g.status,
      handoverMethod: g.handoverMethod,
      createdAt: g.createdAt,
      selectedAt: g.selectedAt,
      transferredAt: g.transferredAt,
      transferConfirmations: claimContracts.filter((c) => c.giveawayClaimId === g.id).map(agreement),
    })),
    reviewsWritten: written.map(review),
    reviewsReceived: received.map(review),
    reportsFiled: filed,
    cases: myDisputes.map((d) => ({
      id: d.id,
      bookingId: d.bookingId,
      yourRole: d.openedBy === me ? "reporter" : "respondent",
      category: d.category,
      status: d.status,
      summary: d.summary,
      openedAt: d.openedAt,
      closedAt: d.closedAt,
      closureNote: d.closureNote,
      events: caseEvents
        .filter((e) => e.disputeId === d.id)
        .map((e) => ({
          kind: e.kind,
          body: e.body,
          mediaId: e.mediaId,
          reference: e.reference,
          at: e.createdAt,
          by:
            e.actorId === null
              ? "system"
              : e.actorId === me
                ? "you"
                : e.actorId === d.openedBy || e.actorId === d.respondentId
                  ? "other_party"
                  : "laandet_support",
        })),
      proposals: proposals
        .filter((p) => p.disputeId === d.id)
        .map((p) => ({
          type: p.type,
          amountOre: p.amountOre,
          newReturnAt: p.newReturnAt,
          text: p.text,
          status: p.status,
          by: p.proposerId === me ? "you" : "other_party",
          createdAt: p.createdAt,
          respondedAt: p.respondedAt,
        })),
    })),
    notifications: notices,
  };
}

export type DataExport = Awaited<ReturnType<typeof buildDataExport>>;

"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  PlayerEmptyState,
  PlayerErrorBanner,
  PlayerPageHeader,
  PlayerPanel,
  PlayerPrimaryButton,
  PlayerSecondaryButton,
  PlayerStatCard,
} from "@/components/player/PlayerUI";
import { supabase } from "@/lib/supabase";
import {
  formatDateTime,
  formatWholeNumber,
  getErrorMessage,
  toNumber,
  toWholeNumber,
} from "@/lib/player/format";

type EligibilityRow = {
  threshold: number | string | null;
  total_cards: number | string | null;
  available_cards: number | string | null;
  reserved_cards: number | string | null;
  progress_percent: number | string | null;
  unlocked: boolean | null;
  active_shipment_id: string | null;
  active_status: string | null;
  active_card_count: number | string | null;
  active_requested_at: string | null;
};

type AddressRow = {
  id: string;
  label: string | null;
  recipient_name: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  country_code: string | null;
  is_default: boolean | null;
};

type ShipmentRow = {
  id: string;
  address_id: string | null;
  status: string | null;
  card_count: number | string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  notes: string | null;
  requested_at: string | null;
  packed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
};

type Eligibility = {
  threshold: number;
  totalCards: number;
  availableCards: number;
  reservedCards: number;
  progress: number;
  unlocked: boolean;
  activeShipmentId: string | null;
  activeStatus: string | null;
  activeCardCount: number;
  activeRequestedAt: string | null;
};

type Address = {
  id: string;
  label: string;
  recipientName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  county: string;
  postcode: string;
  countryCode: string;
  isDefault: boolean;
};

type Shipment = {
  id: string;
  addressId: string | null;
  status: string;
  cardCount: number;
  trackingNumber: string | null;
  trackingUrl: string | null;
  notes: string;
  requestedAt: string | null;
  packedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
};

type AddressForm = Omit<Address, "id"> & {
  id: string | null;
};

const EMPTY_ELIGIBILITY: Eligibility = {
  threshold: 100,
  totalCards: 0,
  availableCards: 0,
  reservedCards: 0,
  progress: 0,
  unlocked: false,
  activeShipmentId: null,
  activeStatus: null,
  activeCardCount: 0,
  activeRequestedAt: null,
};

const EMPTY_ADDRESS: AddressForm = {
  id: null,
  label: "Home",
  recipientName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  county: "",
  postcode: "",
  countryCode: "GB",
  isDefault: true,
};

function parseEligibility(value: unknown): Eligibility {
  const row = Array.isArray(value) ? value[0] : value;

  if (!row || typeof row !== "object") {
    return EMPTY_ELIGIBILITY;
  }

  const data = row as EligibilityRow;

  return {
    threshold: Math.max(
      1,
      toWholeNumber(data.threshold) || 100,
    ),
    totalCards: toWholeNumber(data.total_cards),
    availableCards: toWholeNumber(data.available_cards),
    reservedCards: toWholeNumber(data.reserved_cards),
    progress: Math.min(
      100,
      Math.max(0, toNumber(data.progress_percent)),
    ),
    unlocked: data.unlocked === true,
    activeShipmentId: data.active_shipment_id,
    activeStatus: data.active_status,
    activeCardCount: toWholeNumber(
      data.active_card_count,
    ),
    activeRequestedAt: data.active_requested_at,
  };
}

function parseAddresses(value: unknown): Address[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return (value as AddressRow[]).map((row) => ({
    id: row.id,
    label: row.label?.trim() || "Address",
    recipientName: row.recipient_name?.trim() || "",
    addressLine1: row.address_line_1?.trim() || "",
    addressLine2: row.address_line_2?.trim() || "",
    city: row.city?.trim() || "",
    county: row.county?.trim() || "",
    postcode: row.postcode?.trim() || "",
    countryCode: row.country_code?.trim() || "GB",
    isDefault: row.is_default === true,
  }));
}

function parseShipments(value: unknown): Shipment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return (value as ShipmentRow[]).map((row) => ({
    id: row.id,
    addressId: row.address_id,
    status: row.status || "requested",
    cardCount: toWholeNumber(row.card_count),
    trackingNumber: row.tracking_number,
    trackingUrl: row.tracking_url,
    notes: row.notes || "",
    requestedAt: row.requested_at,
    packedAt: row.packed_at,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    cancelledAt: row.cancelled_at,
  }));
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    requested: "Requested",
    packing: "Being packed",
    shipped: "On the way",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  return labels[status] || status;
}

export default function ShippingPage() {
  const [eligibility, setEligibility] =
    useState<Eligibility>(EMPTY_ELIGIBILITY);
  const [addresses, setAddresses] =
    useState<Address[]>([]);
  const [shipments, setShipments] =
    useState<Shipment[]>([]);

  const [addressForm, setAddressForm] =
    useState<AddressForm>(EMPTY_ADDRESS);
  const [addressEditorOpen, setAddressEditorOpen] =
    useState(false);
  const [selectedAddressId, setSelectedAddressId] =
    useState<string>("");

  const [loading, setLoading] = useState(true);
  const [savingAddress, setSavingAddress] =
    useState(false);
  const [requesting, setRequesting] =
    useState(false);
  const [cancelling, setCancelling] =
    useState(false);
  const [deletingAddressId, setDeletingAddressId] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const loadShipping = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [
        eligibilityResult,
        addressesResult,
        shipmentsResult,
      ] = await Promise.all([
        supabase.rpc(
          "get_player_shipping_eligibility",
        ),
        supabase
          .from("player_shipping_addresses_v2")
          .select(
            "id,label,recipient_name,address_line_1,address_line_2,city,county,postcode,country_code,is_default",
          )
          .order("is_default", {
            ascending: false,
          })
          .order("created_at", {
            ascending: true,
          }),
        supabase
          .from("player_shipping_shipments")
          .select(
            "id,address_id,status,card_count,tracking_number,tracking_url,notes,requested_at,packed_at,shipped_at,delivered_at,cancelled_at",
          )
          .order("requested_at", {
            ascending: false,
          })
          .limit(30),
      ]);

      if (eligibilityResult.error) {
        throw eligibilityResult.error;
      }

      if (addressesResult.error) {
        throw addressesResult.error;
      }

      if (shipmentsResult.error) {
        throw shipmentsResult.error;
      }

      const nextAddresses = parseAddresses(
        addressesResult.data,
      );

      setEligibility(
        parseEligibility(eligibilityResult.data),
      );
      setAddresses(nextAddresses);
      setShipments(
        parseShipments(shipmentsResult.data),
      );

      setSelectedAddressId((current) => {
        if (
          current &&
          nextAddresses.some(
            (address) => address.id === current,
          )
        ) {
          return current;
        }

        return (
          nextAddresses.find(
            (address) => address.isDefault,
          )?.id ||
          nextAddresses[0]?.id ||
          ""
        );
      });
    } catch (error: unknown) {
      console.error("Shipping error:", error);
      setErrorMessage(
        getErrorMessage(
          error,
          "Your shipping centre could not be loaded.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShipping();
  }, [loadShipping]);

  const cardsUntilShipping = Math.max(
    0,
    eligibility.threshold -
      eligibility.availableCards,
  );

  const activeShipment = useMemo(
    () =>
      shipments.find(
        (shipment) =>
          shipment.id ===
          eligibility.activeShipmentId,
      ) || null,
    [shipments, eligibility.activeShipmentId],
  );

  const saveAddress = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (savingAddress) {
        return;
      }

      setSavingAddress(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const { error } = await supabase.rpc(
          "save_player_shipping_address",
          {
            p_address_id: addressForm.id,
            p_label: addressForm.label,
            p_recipient_name:
              addressForm.recipientName,
            p_address_line_1:
              addressForm.addressLine1,
            p_address_line_2:
              addressForm.addressLine2,
            p_city: addressForm.city,
            p_county: addressForm.county,
            p_postcode: addressForm.postcode,
            p_country_code:
              addressForm.countryCode,
            p_is_default: addressForm.isDefault,
          },
        );

        if (error) {
          throw error;
        }

        setAddressEditorOpen(false);
        setAddressForm(EMPTY_ADDRESS);
        setSuccessMessage(
          "Your shipping address has been saved.",
        );
        await loadShipping();
      } catch (error: unknown) {
        setErrorMessage(
          getErrorMessage(
            error,
            "The shipping address could not be saved.",
          ),
        );
      } finally {
        setSavingAddress(false);
      }
    },
    [addressForm, savingAddress, loadShipping],
  );

  const deleteAddress = useCallback(
    async (addressId: string) => {
      if (deletingAddressId) {
        return;
      }

      setDeletingAddressId(addressId);
      setErrorMessage(null);

      try {
        const { error } = await supabase.rpc(
          "delete_player_shipping_address",
          {
            p_address_id: addressId,
          },
        );

        if (error) {
          throw error;
        }

        await loadShipping();
      } catch (error: unknown) {
        setErrorMessage(
          getErrorMessage(
            error,
            "The shipping address could not be deleted.",
          ),
        );
      } finally {
        setDeletingAddressId(null);
      }
    },
    [deletingAddressId, loadShipping],
  );

  const requestShipment = useCallback(async () => {
    if (
      requesting ||
      !selectedAddressId ||
      !eligibility.unlocked ||
      eligibility.activeShipmentId
    ) {
      return;
    }

    setRequesting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error } = await supabase.rpc(
        "request_player_shipment",
        {
          p_address_id: selectedAddressId,
        },
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "Your cards have been reserved and your shipment request is now in the packing queue.",
      );
      await loadShipping();
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(
          error,
          "Your shipment could not be requested.",
        ),
      );
    } finally {
      setRequesting(false);
    }
  }, [
    requesting,
    selectedAddressId,
    eligibility.unlocked,
    eligibility.activeShipmentId,
    loadShipping,
  ]);

  const cancelShipment = useCallback(async () => {
    if (
      cancelling ||
      !eligibility.activeShipmentId
    ) {
      return;
    }

    setCancelling(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.rpc(
        "cancel_player_shipment",
        {
          p_shipment_id:
            eligibility.activeShipmentId,
        },
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "The shipment was cancelled and its cards are available again.",
      );
      await loadShipping();
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(
          error,
          "The shipment could not be cancelled.",
        ),
      );
    } finally {
      setCancelling(false);
    }
  }, [
    cancelling,
    eligibility.activeShipmentId,
    loadShipping,
  ]);

  const openNewAddress = () => {
    setAddressForm({
      ...EMPTY_ADDRESS,
      isDefault: addresses.length === 0,
    });
    setAddressEditorOpen(true);
  };

  const openEditAddress = (address: Address) => {
    setAddressForm({
      ...address,
    });
    setAddressEditorOpen(true);
  };

  return (
    <section className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <PlayerPageHeader
        eyebrow="From your constellation to your door"
        title="Shipping Centre"
        description="Manage delivery details and send available cards."
        actions={
          <>
            <PlayerSecondaryButton
              onClick={openNewAddress}
            >
              Add address
            </PlayerSecondaryButton>

            <PlayerSecondaryButton
              onClick={() => void loadShipping()}
            >
              Refresh shipping
            </PlayerSecondaryButton>
          </>
        }
      />

      <PlayerErrorBanner
        message={errorMessage}
        onRetry={() => void loadShipping()}
      />

      {successMessage ? (
        <div className="mt-6 rounded-2xl border border-emerald-100/15 bg-emerald-300/[0.08] p-4 text-sm font-bold leading-6 text-emerald-50">
          {successMessage}
        </div>
      ) : null}

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PlayerStatCard
          label="Available cards"
          value={formatWholeNumber(
            eligibility.availableCards,
          )}
          detail="Eligible for a new shipment"
          accent="cyan"
        />

        <PlayerStatCard
          label="Reserved cards"
          value={formatWholeNumber(
            eligibility.reservedCards,
          )}
          detail="Assigned to an active shipment"
          accent="pink"
        />

        <PlayerStatCard
          label="Free-shipping target"
          value={formatWholeNumber(
            eligibility.threshold,
          )}
          detail="Available cards required"
          accent="yellow"
        />

        <PlayerStatCard
          label="Shipment status"
          value={
            eligibility.activeStatus
              ? statusLabel(
                  eligibility.activeStatus,
                )
              : eligibility.unlocked
                ? "Unlocked"
                : `${formatWholeNumber(
                    cardsUntilShipping,
                  )} to go`
          }
          detail={
            eligibility.activeRequestedAt
              ? formatDateTime(
                  eligibility.activeRequestedAt,
                )
              : "No active shipment"
          }
          accent="violet"
        />
      </div>

      <PlayerPanel className="relative mt-6 overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-300/[0.09] blur-[105px]" />
        <div className="pointer-events-none absolute -bottom-28 left-16 h-72 w-72 rounded-full bg-violet-400/[0.1] blur-[105px]" />

        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/40">
              Free shipping
            </p>

            <h2 className="mt-3 text-3xl font-black text-white">
              {eligibility.activeShipmentId
                ? `${formatWholeNumber(
                    eligibility.activeCardCount,
                  )} cards are being prepared.`
                : eligibility.unlocked
                  ? "Your collection is ready to travel."
                  : `${formatWholeNumber(
                      cardsUntilShipping,
                    )} cards remain.`}
            </h2>

            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-white/40">
              {eligibility.activeShipmentId
                ? "The cards in this shipment are reserved and cannot be included in another request."
                : eligibility.unlocked
                  ? "Choose an address below and request shipment. Every currently available card will be reserved together."
                  : "Continue making wishes. Reserved cards do not count twice toward another shipment."}
            </p>
          </div>

          <span className="rounded-full border border-cyan-100/15 bg-cyan-200/[0.07] px-4 py-2 text-sm font-black text-cyan-50">
            {formatWholeNumber(
              eligibility.availableCards,
            )}{" "}
            /{" "}
            {formatWholeNumber(
              eligibility.threshold,
            )}
          </span>
        </div>

        <div className="relative mt-7 h-4 overflow-hidden rounded-full border border-white/10 bg-black/25">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-violet-300 to-yellow-200 transition-[width] duration-700"
            style={{
              width: `${eligibility.progress}%`,
            }}
          />
        </div>
      </PlayerPanel>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <PlayerPanel className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-100/40">
                Delivery addresses
              </p>

              <h2 className="mt-2 text-2xl font-black text-white">
                Where should the cards go?
              </h2>
            </div>

            <PlayerSecondaryButton
              onClick={openNewAddress}
            >
              Add
            </PlayerSecondaryButton>
          </div>

          {loading ? (
            <div className="h-72 animate-pulse bg-white/[0.025]" />
          ) : addresses.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-lg font-black text-white">
                No address saved.
              </p>

              <p className="mt-2 text-sm font-semibold text-white/35">
                Add a UK delivery address before
                requesting shipment.
              </p>

              <PlayerPrimaryButton
                onClick={openNewAddress}
                className="mt-5"
              >
                Add first address
              </PlayerPrimaryButton>
            </div>
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
              {addresses.map((address) => (
                <AddressCard
                  key={address.id}
                  address={address}
                  selected={
                    selectedAddressId === address.id
                  }
                  deleting={
                    deletingAddressId === address.id
                  }
                  onSelect={() =>
                    setSelectedAddressId(address.id)
                  }
                  onEdit={() =>
                    openEditAddress(address)
                  }
                  onDelete={() =>
                    void deleteAddress(address.id)
                  }
                />
              ))}
            </div>
          )}
        </PlayerPanel>

        <PlayerPanel className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-100/40">
            Request shipment
          </p>

          {activeShipment ? (
            <div className="mt-5">
              <ShipmentTimeline
                shipment={activeShipment}
              />

              {activeShipment.status === "requested" ? (
                <PlayerSecondaryButton
                  onClick={() =>
                    void cancelShipment()
                  }
                  disabled={cancelling}
                  className="mt-5 w-full border-red-100/15 bg-red-400/[0.07] text-red-100"
                >
                  {cancelling
                    ? "Cancelling..."
                    : "Cancel request"}
                </PlayerSecondaryButton>
              ) : null}
            </div>
          ) : (
            <>
              <p className="mt-4 text-sm font-semibold leading-7 text-white/38">
                The request will include all{" "}
                <strong className="text-white/70">
                  {formatWholeNumber(
                    eligibility.availableCards,
                  )}
                </strong>{" "}
                available cards.
              </p>

              <PlayerPrimaryButton
                onClick={() =>
                  void requestShipment()
                }
                disabled={
                  requesting ||
                  !eligibility.unlocked ||
                  !selectedAddressId
                }
                className="mt-5 w-full"
              >
                {requesting
                  ? "Reserving cards..."
                  : !selectedAddressId
                    ? "Choose an address"
                    : !eligibility.unlocked
                      ? `${formatWholeNumber(
                          cardsUntilShipping,
                        )} cards to unlock`
                      : "Request free shipping"}
              </PlayerPrimaryButton>
            </>
          )}
        </PlayerPanel>
      </div>

      <PlayerPanel className="mt-6 overflow-hidden">
        <div className="border-b border-white/10 p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/40">
            Previous journeys
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            Shipment history
          </h2>
        </div>

        {shipments.length === 0 ? (
          <div className="p-8 text-center text-sm font-semibold text-white/32">
            Your first shipment will appear here.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {shipments.map((shipment) => (
              <ShipmentHistoryRow
                key={shipment.id}
                shipment={shipment}
              />
            ))}
          </div>
        )}
      </PlayerPanel>

      {addressEditorOpen ? (
        <AddressEditor
          form={addressForm}
          saving={savingAddress}
          onChange={setAddressForm}
          onClose={() => {
            setAddressEditorOpen(false);
            setAddressForm(EMPTY_ADDRESS);
          }}
          onSubmit={(event) =>
            void saveAddress(event)
          }
        />
      ) : null}
    </section>
  );
}

function AddressCard({
  address,
  selected,
  deleting,
  onSelect,
  onEdit,
  onDelete,
}: {
  address: Address;
  selected: boolean;
  deleting: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className={`rounded-2xl border p-4 ${
        selected
          ? "border-cyan-100/25 bg-cyan-200/[0.07]"
          : "border-white/10 bg-white/[0.035]"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-black text-white">
            {address.label}
          </h3>

          {address.isDefault ? (
            <span className="rounded-full border border-yellow-100/15 bg-yellow-100/[0.08] px-2.5 py-1 text-[0.52rem] font-black uppercase tracking-[0.1em] text-yellow-50">
              Default
            </span>
          ) : null}
        </div>

        <p className="mt-3 text-sm font-bold text-white/62">
          {address.recipientName}
        </p>

        <p className="mt-2 text-xs font-semibold leading-5 text-white/34">
          {address.addressLine1}
          {address.addressLine2 ? (
            <>
              <br />
              {address.addressLine2}
            </>
          ) : null}
          <br />
          {address.city}
          {address.county
            ? `, ${address.county}`
            : ""}
          <br />
          {address.postcode} ·{" "}
          {address.countryCode}
        </p>
      </button>

      <div className="mt-4 flex gap-2 border-t border-white/[0.07] pt-3">
        <button
          type="button"
          onClick={onEdit}
          className="min-h-9 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-white/50"
        >
          Edit
        </button>

        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="min-h-9 flex-1 rounded-xl border border-red-100/10 bg-red-400/[0.05] px-3 text-xs font-black text-red-100/65 disabled:opacity-40"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </article>
  );
}

function ShipmentTimeline({
  shipment,
}: {
  shipment: Shipment;
}) {
  const steps = [
    {
      key: "requested",
      label: "Requested",
      reached: true,
    },
    {
      key: "packing",
      label: "Packing",
      reached: [
        "packing",
        "shipped",
        "delivered",
      ].includes(shipment.status),
    },
    {
      key: "shipped",
      label: "Shipped",
      reached: ["shipped", "delivered"].includes(
        shipment.status,
      ),
    },
    {
      key: "delivered",
      label: "Delivered",
      reached: shipment.status === "delivered",
    },
  ];

  return (
    <div>
      <span className="inline-flex rounded-full border border-violet-100/15 bg-violet-200/[0.08] px-3 py-1.5 text-xs font-black text-violet-50">
        {statusLabel(shipment.status)}
      </span>

      <h3 className="mt-4 text-xl font-black text-white">
        {formatWholeNumber(shipment.cardCount)} cards
      </h3>

      <p className="mt-2 text-xs font-semibold text-white/30">
        Requested {formatDateTime(shipment.requestedAt)}
      </p>

      <div className="mt-6 space-y-3">
        {steps.map((step) => (
          <div
            key={step.key}
            className="flex items-center gap-3"
          >
            <span
              className={`h-3 w-3 rounded-full ${
                step.reached
                  ? "bg-cyan-200 shadow-[0_0_12px_rgba(165,243,252,0.75)]"
                  : "bg-white/10"
              }`}
            />

            <span
              className={`text-xs font-black ${
                step.reached
                  ? "text-white/70"
                  : "text-white/22"
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {shipment.trackingUrl ? (
        <a
          href={shipment.trackingUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex min-h-11 items-center justify-center rounded-xl border border-cyan-100/15 bg-cyan-200/[0.06] px-4 text-xs font-black text-cyan-50"
        >
          Track shipment
        </a>
      ) : null}
    </div>
  );
}

function ShipmentHistoryRow({
  shipment,
}: {
  shipment: Shipment;
}) {
  return (
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-black text-white">
            {formatWholeNumber(shipment.cardCount)} cards
          </span>

          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.55rem] font-black uppercase tracking-[0.1em] text-white/38">
            {statusLabel(shipment.status)}
          </span>
        </div>

        <p className="mt-2 text-xs font-semibold text-white/27">
          {formatDateTime(shipment.requestedAt)}
        </p>
      </div>

      <div className="text-left sm:text-right">
        {shipment.trackingNumber ? (
          <p className="text-xs font-bold text-cyan-100/45">
            {shipment.trackingNumber}
          </p>
        ) : (
          <p className="text-xs font-bold text-white/22">
            No tracking yet
          </p>
        )}

        {shipment.notes ? (
          <p className="mt-1 max-w-md text-xs font-semibold text-white/28">
            {shipment.notes}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AddressEditor({
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: AddressForm;
  saving: boolean;
  onChange: (form: AddressForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-[#01020d]/90 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label="Shipping address editor"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <PlayerPanel className="my-auto w-full max-w-2xl p-5 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/40">
              Delivery address
            </p>

            <h2 className="mt-2 text-2xl font-black text-white">
              {form.id ? "Edit address" : "Add address"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close address editor"
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-white"
          >
            X
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="mt-6 grid gap-4 sm:grid-cols-2"
        >
          <AddressField label="Label">
            <input
              value={form.label}
              onChange={(event) =>
                onChange({
                  ...form,
                  label: event.target.value,
                })
              }
              required
              maxLength={40}
              className="shipping-input"
            />
          </AddressField>

          <AddressField label="Recipient name">
            <input
              value={form.recipientName}
              onChange={(event) =>
                onChange({
                  ...form,
                  recipientName: event.target.value,
                })
              }
              required
              maxLength={120}
              className="shipping-input"
            />
          </AddressField>

          <AddressField
            label="Address line 1"
            className="sm:col-span-2"
          >
            <input
              value={form.addressLine1}
              onChange={(event) =>
                onChange({
                  ...form,
                  addressLine1: event.target.value,
                })
              }
              required
              maxLength={160}
              className="shipping-input"
            />
          </AddressField>

          <AddressField
            label="Address line 2"
            className="sm:col-span-2"
          >
            <input
              value={form.addressLine2}
              onChange={(event) =>
                onChange({
                  ...form,
                  addressLine2: event.target.value,
                })
              }
              maxLength={160}
              className="shipping-input"
            />
          </AddressField>

          <AddressField label="City">
            <input
              value={form.city}
              onChange={(event) =>
                onChange({
                  ...form,
                  city: event.target.value,
                })
              }
              required
              maxLength={100}
              className="shipping-input"
            />
          </AddressField>

          <AddressField label="County">
            <input
              value={form.county}
              onChange={(event) =>
                onChange({
                  ...form,
                  county: event.target.value,
                })
              }
              maxLength={100}
              className="shipping-input"
            />
          </AddressField>

          <AddressField label="Postcode">
            <input
              value={form.postcode}
              onChange={(event) =>
                onChange({
                  ...form,
                  postcode:
                    event.target.value.toUpperCase(),
                })
              }
              required
              maxLength={20}
              className="shipping-input"
            />
          </AddressField>

          <AddressField label="Country code">
            <input
              value={form.countryCode}
              onChange={(event) =>
                onChange({
                  ...form,
                  countryCode: event.target.value
                    .toUpperCase()
                    .slice(0, 2),
                })
              }
              required
              minLength={2}
              maxLength={2}
              className="shipping-input"
            />
          </AddressField>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-4 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) =>
                onChange({
                  ...form,
                  isDefault: event.target.checked,
                })
              }
              className="mt-1 h-4 w-4 accent-violet-300"
            />

            <span>
              <strong className="block text-sm text-white">
                Make this the default address
              </strong>
              <span className="mt-1 block text-xs font-semibold text-white/30">
                It will be selected automatically for future
                shipment requests.
              </span>
            </span>
          </label>

          <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row">
            <PlayerPrimaryButton
              type="submit"
              disabled={saving}
              className="flex-1"
            >
              {saving ? "Saving..." : "Save address"}
            </PlayerPrimaryButton>

            <PlayerSecondaryButton
              onClick={onClose}
              disabled={saving}
              className="flex-1"
            >
              Cancel
            </PlayerSecondaryButton>
          </div>
        </form>

        <style jsx global>{`
          .shipping-input {
            min-height: 3rem;
            width: 100%;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 0.75rem;
            background: rgba(255, 255, 255, 0.045);
            padding-left: 1rem;
            padding-right: 1rem;
            color: white;
            font-size: 0.875rem;
            font-weight: 600;
            outline: none;
          }

          .shipping-input:focus {
            border-color: rgba(165, 243, 252, 0.25);
            box-shadow: 0 0 0 2px rgba(165, 243, 252, 0.07);
          }
        `}</style>
      </PlayerPanel>
    </div>
  );
}

function AddressField({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-white/35">
        {label}
      </span>
      {children}
    </label>
  );
}

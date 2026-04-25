import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createBooking, getBookings, getOpenSlots, payBooking } from "../services/bookings";
import { getServices } from "../services/services";
import { getTrainers } from "../services/trainers";
import { ROUTES } from "../lib/navigation";
import { useAuth } from "../state/auth-context";
import toast from "react-hot-toast";
import { ChevronRight, Calendar, CreditCard, User, Clock, CheckCircle, ArrowLeft } from "lucide-react";
import { format, addDays, startOfToday } from "date-fns";

function isNutritionSpecialty(value: string | null | undefined): boolean {
  const text = (value ?? "").toLowerCase();
  return text.includes("nutri") || text.includes("diet") || text.includes("meal");
}

function classifyProfessional(trainer: { profiles?: { role?: string }; specialty?: string | null }): "trainer" | "nutritionist" | "unknown" {
  if (trainer.profiles?.role === "trainer") return "trainer";
  if (trainer.profiles?.role === "nutritionist") return "nutritionist";
  if (isNutritionSpecialty(trainer.specialty)) return "nutritionist";
  if ((trainer.specialty ?? "").trim()) return "trainer";
  return "unknown";
}

export function BookingPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [trainerId, setTrainerId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  
  // Custom Date selection state taking form of a visual strip
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const formattedQueryDate = format(selectedDate, "yyyy-MM-dd");

  const [selectedSlot, setSelectedSlot] = useState<{ date: string; startTime: string; endTime: string } | null>(null);
  const bookingWith = searchParams.get("with");
  const specificTrainerId = searchParams.get("trainerId") ?? "";
  const isLockedToProfile = Boolean(specificTrainerId);

  const trainersQuery = useQuery({ queryKey: ["trainers"], queryFn: getTrainers });
  const verifiedProfessionals = useMemo(() => {
    let base = (trainersQuery.data ?? []).filter((t) => t.verified);
    if (specificTrainerId) {
      base = base.filter((trainer) => trainer.id === specificTrainerId);
    }
    if (bookingWith === "trainer") {
      return base.filter((trainer) => classifyProfessional(trainer) === "trainer");
    }
    if (bookingWith === "nutritionist") {
      return base.filter((trainer) => classifyProfessional(trainer) === "nutritionist");
    }
    return base;
  }, [bookingWith, trainersQuery.data, specificTrainerId]);

  const servicesByTrainer = useQueries({
    queries: verifiedProfessionals.map((trainer) => ({
      queryKey: ["services", trainer.id],
      queryFn: () => getServices(trainer.id),
      enabled: Boolean(trainer.id),
    })),
  });

  const bookingsQuery = useQuery({ queryKey: ["bookings"], queryFn: () => getBookings(token) });

  const openSlotsQuery = useQuery({
    queryKey: ["open-slots", trainerId, selectedServiceId, formattedQueryDate],
    queryFn: () => getOpenSlots(trainerId, selectedServiceId, formattedQueryDate, format(addDays(selectedDate, 7), "yyyy-MM-dd")),
    enabled: Boolean(trainerId && selectedServiceId && formattedQueryDate),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createBooking(token, {
        trainerId,
        serviceId: selectedServiceId,
        bookingDate: selectedSlot?.date ?? formattedQueryDate,
        startTime: selectedSlot?.startTime ?? "10:00:00",
        endTime: selectedSlot?.endTime ?? "11:00:00",
        notes: "Booked from VaultFit Client Portal",
      }),
    onSuccess: () => {
      toast.success("Booking created successfully!");
      setStep(1);
      setSelectedSlot(null);
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const payMutation = useMutation({
    mutationFn: (bookingId: string) => payBooking(token, bookingId),
    onSuccess: () => {
      toast.success("Payment successful!");
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const serviceOptions = useMemo(() =>
    servicesByTrainer.flatMap((query, index) => {
      const trainer = verifiedProfessionals[index];
      if (!trainer) return [];
      return (query.data ?? []).filter((s) => s.is_active).map((s) => ({
        ...s,
        trainerName: trainer.profiles?.full_name ?? "Unnamed Trainer",
      }));
    }),
  [servicesByTrainer, verifiedProfessionals]);

  const selectedService = useMemo(() => serviceOptions.find((s) => s.id === selectedServiceId) ?? null, [selectedServiceId, serviceOptions]);
  const selectedProfessional = useMemo(
    () => verifiedProfessionals.find((p) => p.id === specificTrainerId) ?? null,
    [specificTrainerId, verifiedProfessionals],
  );

  useEffect(() => {
    if (!specificTrainerId) return;
    setTrainerId(specificTrainerId);
  }, [specificTrainerId]);

  const handleServiceSelect = (serviceId: string, trId: string) => {
    setSelectedServiceId(serviceId);
    setTrainerId(trId);
    setSelectedSlot(null);
    setStep(2);
  };

  const openSlots = openSlotsQuery.data ?? [];
  const slotsByDate = useMemo(() => {
    return openSlots.reduce<Record<string, typeof openSlots>>((acc, slot) => {
      acc[slot.date] = acc[slot.date] ? [...acc[slot.date], slot] : [slot];
      return acc;
    }, {});
  }, [openSlots]);

  const orderedSlotDates = useMemo(() => Object.keys(slotsByDate).sort((a, b) => a.localeCompare(b)), [slotsByDate]);

  return (
    <div className="wizard-container">
      {/* WIZARD PROGRESS BAR */}
      <div className="wizard-progress">
        <div className={`wizard-step ${step >= 1 ? 'active' : ''}`}>
          <div className="step-icon"><User size={18} /></div>
          <span>Service</span>
        </div>
        <div className="wizard-line" />
        <div className={`wizard-step ${step >= 2 ? 'active' : ''}`}>
          <div className="step-icon"><Calendar size={18} /></div>
          <span>Schedule</span>
        </div>
        <div className="wizard-line" />
        <div className={`wizard-step ${step >= 3 ? 'active' : ''}`}>
          <div className="step-icon"><CreditCard size={18} /></div>
          <span>Review</span>
        </div>
      </div>

      <div className="wizard-content">
        {/* STEP 1: SELECT SERVICE */}
        {step === 1 && (
          <div className="step-section">
            <h2 className="step-title">Choose a Service</h2>
            <p className="muted mb-4">
              Select the {bookingWith === "nutritionist" ? "nutritionist" : bookingWith === "trainer" ? "trainer" : "professional"} and service you'd like to book.
            </p>
            <p className="muted mb-3">
              Active filter:{" "}
              <strong>{bookingWith === "nutritionist" ? "Nutritionists only" : bookingWith === "trainer" ? "Trainers only" : "All professionals"}</strong>
              {specificTrainerId ? " · Selected profile only" : ""}
            </p>
            {isLockedToProfile ? (
              <p className="muted mb-4">
                Booking with: <strong>{selectedProfessional?.profiles?.full_name ?? "Selected professional"}</strong>
              </p>
            ) : (
              <div className="flex gap-2 mb-4 flex-wrap">
                <Link className={`secondary-btn ${bookingWith === "trainer" ? "active-filter-btn" : ""}`} to={`${ROUTES.client.book}?with=trainer`}>
                  Trainers only
                </Link>
                <Link
                  className={`secondary-btn ${bookingWith === "nutritionist" ? "active-filter-btn" : ""}`}
                  to={`${ROUTES.client.book}?with=nutritionist`}
                >
                  Nutritionists only
                </Link>
                <Link className={`secondary-btn ${!bookingWith ? "active-filter-btn" : ""}`} to={ROUTES.client.book}>
                  All professionals
                </Link>
              </div>
            )}
            <div className="service-grid">
              {serviceOptions.map((service) => (
                <div key={service.id} className="service-card" onClick={() => handleServiceSelect(service.id, service.trainer_id)}>
                  <div className="service-card-header">
                    <h4>{service.title}</h4>
                    <span className="price-tag">${service.price}</span>
                  </div>
                  <div className="service-card-body">
                    <p className="flex items-center gap-2"><User size={14} /> {service.trainerName}</p>
                    <p className="flex items-center gap-2"><Clock size={14} /> {service.duration_minutes} min</p>
                  </div>
                  <button className="secondary-btn w-full mt-3">Select</button>
                </div>
              ))}
              {serviceOptions.length === 0 && (
                <p className="muted">
                  No {bookingWith === "nutritionist" ? "nutritionist" : bookingWith === "trainer" ? "trainer" : "professional"} services
                  available right now.
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: SCHEDULE */}
        {step === 2 && selectedService && (
          <div className="step-section animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="step-title m-0">Select Time Slide</h2>
              <button className="text-btn flex items-center gap-1" onClick={() => setStep(1)}><ArrowLeft size={16} /> Back</button>
            </div>
            
            <div className="card glass-card">
              <div className="date-strip">
                {[...Array(7)].map((_, i) => {
                  const d = addDays(startOfToday(), i);
                  const isSelected = format(d, "yyyy-MM-dd") === formattedQueryDate;
                  return (
                    <button 
                      key={i} 
                      className={`date-pill ${isSelected ? 'active' : ''}`}
                      onClick={() => setSelectedDate(d)}
                    >
                      <span className="date-day">{format(d, "EEE")}</span>
                      <span className="date-num">{format(d, "dd")}</span>
                    </button>
                  );
                })}
              </div>

              <div className="slot-grid-container mt-6">
                <h4 className="mb-3">Open Slots for week of {format(selectedDate, "MMM do")}</h4>
                {openSlotsQuery.isLoading && <div className="spinner" />}
                {!openSlotsQuery.isLoading && openSlots.length === 0 && (
                  <p className="muted p-4 text-center border dashed rounded-md">No open slots this week.</p>
                )}
                
                {orderedSlotDates.map((date) => (
                  <div key={date} className="day-slots mb-4">
                    <p className="slot-header">{format(new Date(date), "EEEE, MMM do")}</p>
                    <div className="flex gap-2 flex-wrap">
                      {(slotsByDate[date] ?? []).map((slot, idx) => (
                        <button
                          key={idx}
                          className={`slot-pill ${selectedSlot?.startTime === slot.startTime && selectedSlot?.date === slot.date ? 'active' : ''}`}
                          onClick={() => setSelectedSlot(slot)}
                        >
                          {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button 
              className="primary-btn mt-6 w-full max-w-sm ml-auto flex"
              disabled={!selectedSlot}
              onClick={() => setStep(3)}
            >
              Continue to Review <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* STEP 3: REVIEW */}
        {step === 3 && selectedService && selectedSlot && (
          <div className="step-section animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="step-title m-0">Confirm Booking</h2>
              <button className="text-btn flex items-center gap-1" onClick={() => setStep(2)}><ArrowLeft size={16} /> Back</button>
            </div>
            
            <div className="card glass-card review-card">
              <CheckCircle size={48} className="text-success mb-4" />
              <h3>Ready to Book!</h3>
              <div className="review-details">
                <div className="review-row"><span>Service</span> <strong>{selectedService.title}</strong></div>
                <div className="review-row"><span>Trainer</span> <strong>{selectedService.trainerName}</strong></div>
                <div className="review-row"><span>Date</span> <strong>{format(new Date(selectedSlot.date), "MMMM do, yyyy")}</strong></div>
                <div className="review-row"><span>Time</span> <strong>{selectedSlot.startTime.slice(0, 5)} - {selectedSlot.endTime.slice(0, 5)}</strong></div>
                <div className="review-divider" />
                <div className="review-row total"><span>Total Cost</span> <strong>${selectedService.price}</strong></div>
              </div>
              
              <button 
                className="primary-btn w-full mt-6"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Confirming..." : "Confirm & Book"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DASHBOARD: YOUR SESSIONS */}
      <div className="mt-12">
        <h2>Your Upcoming Sessions</h2>
        <div className="card">
          {bookingsQuery.isLoading && <div className="spinner" />}
          <div className="sessions-list">
            {(bookingsQuery.data ?? []).length === 0 && !bookingsQuery.isLoading && (
              <p className="muted text-center py-4">You have no upcoming sessions.</p>
            )}
            {(bookingsQuery.data ?? []).map((booking) => (
              <div key={booking.id} className="session-row">
                <div className="session-info">
                  <div className="session-icon"><Calendar size={20} /></div>
                  <div>
                    <h4 className="m-0 mb-1">{booking.booking_date}</h4>
                    <p className="text-sm muted m-0">{booking.start_time.slice(0,5)} - {booking.end_time.slice(0,5)}</p>
                  </div>
                </div>
                <div className="session-actions">
                  <span className={`badge badge-${booking.status === 'pending' ? 'warning' : 'success'}`}>{booking.status}</span>
                  {booking.status === "pending" && (
                     <button className="secondary-btn btn-sm" disabled={payMutation.isPending} onClick={() => payMutation.mutate(booking.id)}>
                       Pay Now
                     </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .wizard-container { max-width: 900px; margin: 0 auto; }
        .wizard-progress { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2.5rem; padding: 1rem 2rem; background: var(--bg-card); border-radius: 100px; border: 1px solid var(--border-light); }
        .wizard-step { display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); opacity: 0.6; transition: all 0.3s; }
        .wizard-step.active { color: var(--primary); opacity: 1; font-weight: 600; }
        .step-icon { width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; justify-content: center; align-items: center; }
        .wizard-step.active .step-icon { background: var(--primary); color: white; box-shadow: 0 0 15px rgba(79, 70, 229, 0.4); }
        .wizard-line { flex: 1; height: 2px; background: var(--border-light); margin: 0 1rem; }
        
        .step-title { font-size: 1.5rem; margin-bottom: 0.5rem; }
        
        .service-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; }
        .service-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1.25rem; cursor: pointer; transition: all 0.2s; }
        .service-card:hover { border-color: var(--primary); transform: translateY(-3px); box-shadow: var(--shadow-sm); }
        .service-card-header { display: flex; justify-content: space-between; margin-bottom: 1rem; }
        .service-card-header h4 { margin: 0; font-size: 1.1rem; }
        .price-tag { background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 0.2rem 0.5rem; border-radius: var(--radius-sm); font-weight: 700; }
        .service-card-body p { margin: 0 0 0.5rem 0; color: var(--text-secondary); font-size: 0.9rem; }
        
        .date-strip { display: flex; gap: 0.75rem; overflow-x: auto; padding-bottom: 0.5rem; }
        .date-pill { flex: 1; min-width: 70px; display: flex; flex-direction: column; align-items: center; padding: 1rem; background: rgba(255,255,255,0.02); border: 1px solid var(--border-light); border-radius: var(--radius-md); transition: all 0.2s; color: var(--text-secondary); }
        .date-pill:hover { background: rgba(255,255,255,0.05); }
        .date-pill.active { background: var(--primary); color: white; border-color: var(--primary); }
        .date-day { font-size: 0.8rem; text-transform: uppercase; font-weight: 600; margin-bottom: 0.25rem; }
        .date-num { font-size: 1.25rem; font-weight: 700; }
        
        .slot-header { font-size: 0.9rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase; }
        .slot-pill { padding: 0.6rem 1rem; background: rgba(255,255,255,0.03); border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-family: monospace; font-size: 0.95rem; transition: all 0.2s; color: var(--text-primary); cursor: pointer; }
        .slot-pill:hover { background: rgba(255,255,255,0.08); }
        .slot-pill.active { background: rgba(79, 70, 229, 0.2); border-color: var(--primary); color: white; box-shadow: 0 0 10px rgba(79, 70, 229, 0.2); }
        
        .review-card { max-width: 500px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; padding: 2.5rem; }
        .review-details { width: 100%; margin-top: 1.5rem; background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: var(--radius-md); }
        .review-row { display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-size: 0.95rem; }
        .review-divider { height: 1px; background: var(--border-light); margin: 1rem 0; }
        .review-row.total { font-size: 1.1rem; color: var(--primary); font-weight: 700; }
        
        .text-btn { background: none; border: none; color: var(--text-secondary); cursor: pointer; transition: color 0.2s; }
        .text-btn:hover { color: white; }
        
        .session-row { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border: 1px solid var(--border-light); border-radius: var(--radius-md); margin-bottom: 0.75rem; background: rgba(255,255,255,0.02); }
        .session-info { display: flex; align-items: center; gap: 1rem; }
        .session-icon { background: rgba(79, 70, 229, 0.15); color: var(--primary); padding: 0.75rem; border-radius: var(--radius-md); }
        .session-actions { display: flex; gap: 1rem; align-items: center; }
        .btn-sm { padding: 0.4rem 0.8rem; font-size: 0.85rem; }
        .active-filter-btn {
          border-color: var(--primary);
          box-shadow: inset 0 0 0 1px var(--primary);
          background: rgba(79, 70, 229, 0.18);
          color: #fff;
          text-decoration: none;
        }
        
        .flex { display: flex; }
        .items-center { align-items: center; }
        .justify-between { justify-content: space-between; }
        .gap-1 { gap: 0.25rem; }
        .gap-2 { gap: 0.5rem; }
        .w-full { width: 100%; }
        .max-w-sm { max-width: 24rem; }
        .ml-auto { margin-left: auto; }
        .text-center { text-align: center; }
        .border { border: 1px solid var(--border-light); }
        .dashed { border-style: dashed; }
        .rounded-md { border-radius: var(--radius-md); }
        .p-4 { padding: 1rem; }
        .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
        .m-0 { margin: 0; }
        .mb-1 { margin-bottom: 0.25rem; }
        .mb-3 { margin-bottom: 0.75rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mt-3 { margin-top: 0.75rem; }
        .mt-6 { margin-top: 1.5rem; }
        .mt-12 { margin-top: 3rem; }
        .text-success { color: #34d399; }
        .spinner { border: 3px solid rgba(255,255,255,0.1); border-top-color: var(--primary); border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-fade-in { animation: fadeIn 0.4s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

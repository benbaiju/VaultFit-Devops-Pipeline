import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createService, deleteService, getServices, updateService } from "../services/services";
import { getTrainers } from "../services/trainers";
import { useAuth } from "../state/auth-context";

export function ServicesPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTrainerId, setSelectedTrainerId] = useState("");
  const [title, setTitle] = useState("");
  const [serviceType, setServiceType] = useState<"session" | "program" | "consultation">("session");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [price, setPrice] = useState(90);
  const [error, setError] = useState("");

  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
  });

  const trainers = trainersQuery.data ?? [];

  const effectiveTrainerId = useMemo(() => {
    if (user?.role === "trainer") {
      const mine = trainers.find((t) => t.user_id === user.id);
      return mine?.id ?? "";
    }
    return selectedTrainerId;
  }, [selectedTrainerId, trainers, user?.id, user?.role]);

  const servicesQuery = useQuery({
    queryKey: ["services", effectiveTrainerId],
    queryFn: () => getServices(effectiveTrainerId),
    enabled: Boolean(effectiveTrainerId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createService(token, effectiveTrainerId, {
        title,
        serviceType,
        durationMinutes,
        price,
        isActive: true,
      }),
    onSuccess: () => {
      setError("");
      setTitle("");
      void queryClient.invalidateQueries({ queryKey: ["services", effectiveTrainerId] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const toggleMutation = useMutation({
    mutationFn: (params: { serviceId: string; isActive: boolean }) =>
      updateService(token, effectiveTrainerId, params.serviceId, { isActive: !params.isActive }),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["services", effectiveTrainerId] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (serviceId: string) => deleteService(token, effectiveTrainerId, serviceId),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["services", effectiveTrainerId] });
    },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <section>
      <h2>Services</h2>
      {user?.role === "admin" ? (
        <div className="card">
          <label>Trainer</label>
          <select value={selectedTrainerId} onChange={(e) => setSelectedTrainerId(e.target.value)}>
            <option value="">Select trainer</option>
            {trainers.map((trainer) => (
              <option key={trainer.id} value={trainer.id}>
                {trainer.profiles?.full_name ?? trainer.id}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="card">
        <h3>Create Service</h3>
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="60-min online PT session" />
        <label>Type</label>
        <select value={serviceType} onChange={(e) => setServiceType(e.target.value as "session" | "program" | "consultation")}>
          <option value="session">session</option>
          <option value="program">program</option>
          <option value="consultation">consultation</option>
        </select>
        <label>Duration (minutes)</label>
        <input
          type="number"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Number(e.target.value))}
          min={15}
        />
        <label>Price (AUD)</label>
        <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} min={0} />
        <button
          className="primary-btn"
          disabled={!effectiveTrainerId || !title || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "Creating..." : "Create service"}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </div>

      <div className="card">
        <h3>Existing Services</h3>
        {servicesQuery.isLoading ? <p>Loading services...</p> : null}
        <ul className="list">
          {(servicesQuery.data ?? []).map((service) => (
            <li key={service.id}>
              <span>
                <b>{service.title}</b> ({service.service_type}) - {service.duration_minutes}m - ${service.price}
                <span className={`badge ${service.is_active ? "badge-success" : "badge-muted"}`}>
                  {service.is_active ? "Active" : "Inactive"}
                </span>
              </span>
              <div className="inline-actions">
                <button
                  className="secondary-btn"
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate({ serviceId: service.id, isActive: service.is_active })}
                >
                  {service.is_active ? "Deactivate" : "Activate"}
                </button>
                <button
                  className="secondary-btn"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(service.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

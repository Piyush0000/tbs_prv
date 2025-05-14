"use client"; // Ensure this is a Client Component

function SubscriptionPlan({ plan, isSelected, onSelect, isCurrentPlan }) {
  // If the plan is disabled, show a blank card with "Plan Coming Soon"
  if (plan.disabled) {
    return (
      <div className="relative border rounded-xl p-6 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
        <p className="text-center text-text-light dark:text-text-dark font-medium">
          Plan Coming Soon
        </p>
      </div>
    );
  }

  return (
    <div
      className={`
        relative border rounded-xl p-6 transition-all hover:shadow-lg
        ${isSelected ? "border-border-dark dark:border-border-light shadow-lg" : "border-border-light dark:border-border-dark"}
        ${isCurrentPlan ? "bg-backgroundSCD-light dark:bg-backgroundSCD-dark" : "bg-background-light dark:bg-background-dark"}
      `}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-light dark:bg-primary-dark text-text-light dark:text-text-dark text-sm py-1 px-4 rounded-full">
          Most Popular
        </div>
      )}

      <div className="h-48 mb-6 overflow-hidden rounded-lg">
        <img
          src="https://i.pinimg.com/564x/ed/f4/f6/edf4f6c42624c31db77d8352e6575841.jpg"
          alt={`${plan.name} plan showing ${plan.booksPerMonth} book${plan.booksPerMonth > 1 ? "s" : ""}`}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold font-header mb-2 text-text-light dark:text-text-dark">{plan.name}</h3>
        <p className="text-4xl font-bold text-text-light dark:text-text-dark">
          ₹{plan.price}
          <span className="text-sm font-normal text-text-light dark:text-text-dark">/month</span>
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex items-center text-text-light dark:text-text-dark">
          <i className="fas fa-book text-primary-light dark:text-primary-dark mr-3"></i>
          <span className="font-medium font-body">
            Plus a security deposit of 299/-
          </span>
        </div>

        <div className="flex items-center text-text-light dark:text-text-dark">
          <i className="fas fa-coffee text-secondary-light dark:text-secondary-dark mr-3"></i>
          <span className="font-medium font-body">100% refunded once the subscription ends</span>
        </div>

        <div className="h-px bg-border-light dark:bg-border-dark my-4"></div>

        {plan.features.map((feature, index) => (
          <div key={index} className="flex items-center text-text-light dark:text-text-dark">
            <i className="fas fa-check text-tertiary-light dark:text-tertiary-dark mr-3"></i>
            <span className="font-body">{feature}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onSelect}
        className={`w-full py-3 px-4 rounded-full font-medium transition-colors font-button
          ${isCurrentPlan ? "bg-backgroundSCD-light dark:bg-backgroundSCD-dark cursor-not-allowed" : ""}
          ${isSelected ? "bg-primary-light dark:bg-primary-dark text-text-light dark:text-text-dark hover:bg-primary-light dark:hover:bg-primary-dark" : "bg-background-light dark:bg-background-dark hover:bg-backgroundSCD-light dark:hover:bg-backgroundSCD-dark"}
        `}
        disabled={isCurrentPlan}
      >
        {isCurrentPlan ? "Current Plan" : "Select Plan"}
      </button>
    </div>
  );
}

export default SubscriptionPlan;

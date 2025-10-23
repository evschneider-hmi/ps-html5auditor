import React from 'react';
import { Icon, IconName } from './Icon';
import './Badge.css';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'cm360' | 'iab';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps {
  variant: BadgeVariant;
  size?: BadgeSize;
  icon?: IconName;
  count?: number;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant,
  size = 'md',
  icon,
  count,
  children,
  className = '',
  style = {},
  title,
}) => {
  const iconSize = {
    sm: 12,
    md: 16,
    lg: 18,
  }[size];

  const variantClasses = {
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info',
    neutral: 'badge-neutral',
    cm360: 'badge-cm360',
    iab: 'badge-iab',
  };

  const content = count !== undefined ? count : children;

  return (
    <span
      className={`badge badge-${size} ${variantClasses[variant]} ${className}`}
      style={style}
      title={title}
    >
      {icon && <Icon name={icon} size={iconSize} className="badge-icon" />}
      {content}
    </span>
  );
};

// Specialized badge variants for common use cases
export const StatusBadge: React.FC<{
  status: 'PASS' | 'WARN' | 'FAIL';
  size?: BadgeSize;
  count?: number;
}> = ({ status, size = 'md', count }) => {
  const config = {
    PASS: { variant: 'success' as BadgeVariant, icon: 'check' as IconName, label: 'PASS' },
    WARN: { variant: 'warning' as BadgeVariant, icon: 'warning' as IconName, label: 'WARN' },
    FAIL: { variant: 'error' as BadgeVariant, icon: 'error' as IconName, label: 'FAIL' },
  };

  const { variant, icon, label } = config[status];

  return (
    <Badge
      variant={variant}
      icon={icon}
      size={size}
      count={count}
      title={`${count !== undefined ? `${count} ` : ''}${label} checks`}
    >
      {count === undefined && label}
    </Badge>
  );
};

export const ProfileBadgeComponent: React.FC<{
  profile: 'CM360' | 'IAB' | 'Both';
  size?: BadgeSize;
}> = ({ profile, size = 'md' }) => {
  if (profile === 'Both') {
    return (
      <span className="profile-badges">
        <Badge variant="cm360" size={size}>
          CM360
        </Badge>
        <Badge variant="iab" size={size}>
          IAB
        </Badge>
      </span>
    );
  }

  return (
    <Badge variant={profile === 'CM360' ? 'cm360' : 'iab'} size={size}>
      {profile}
    </Badge>
  );
};

export const CountBadge: React.FC<{
  count: number;
  variant?: BadgeVariant;
  size?: BadgeSize;
  label?: string;
}> = ({ count, variant = 'neutral', size = 'sm', label }) => {
  return (
    <Badge variant={variant} size={size} count={count} title={label}>
      {count}
    </Badge>
  );
};

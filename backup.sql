--
-- PostgreSQL database dump
--

\restrict TvoXCbgQaY8YQDeAiX3hTyUEFu7a0GYPOhzW2y8I3VNgqO9WotYGMy3VkIYVUNC

-- Dumped from database version 17.8
-- Dumped by pg_dump version 17.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alerts (
    id bigint NOT NULL,
    user_id bigint,
    location_id bigint,
    alert_type character varying(50) NOT NULL,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.alerts OWNER TO postgres;

--
-- Name: alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.alerts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alerts_id_seq OWNER TO postgres;

--
-- Name: alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alerts_id_seq OWNED BY public.alerts.id;


--
-- Name: assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.assets (
    id bigint NOT NULL,
    location_id bigint,
    asset_code character varying(100) NOT NULL,
    name character varying(180) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.assets OWNER TO postgres;

--
-- Name: assets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.assets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.assets_id_seq OWNER TO postgres;

--
-- Name: assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.assets_id_seq OWNED BY public.assets.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    user_id bigint,
    action character varying(120) NOT NULL,
    entity_type character varying(80) NOT NULL,
    entity_id bigint,
    details jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id bigint NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: inventory_balance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_balance (
    item_id bigint NOT NULL,
    location_id bigint NOT NULL,
    quantity numeric(18,2) DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_balance_quantity_non_negative CHECK ((quantity >= (0)::numeric))
);


ALTER TABLE public.inventory_balance OWNER TO postgres;

--
-- Name: inventory_count_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_count_items (
    id bigint NOT NULL,
    count_id bigint NOT NULL,
    item_id bigint NOT NULL,
    system_quantity numeric(18,2) DEFAULT 0 NOT NULL,
    counted_quantity numeric(18,2) DEFAULT 0 NOT NULL,
    variance_quantity numeric(18,2) DEFAULT 0 NOT NULL
);


ALTER TABLE public.inventory_count_items OWNER TO postgres;

--
-- Name: inventory_count_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_count_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_count_items_id_seq OWNER TO postgres;

--
-- Name: inventory_count_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_count_items_id_seq OWNED BY public.inventory_count_items.id;


--
-- Name: inventory_counts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_counts (
    id bigint NOT NULL,
    location_id bigint NOT NULL,
    section_id bigint,
    counted_by bigint NOT NULL,
    status character varying(30) DEFAULT 'DRAFT'::character varying NOT NULL,
    count_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_counts_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'POSTED'::character varying, 'CANCELLED'::character varying])::text[])))
);


ALTER TABLE public.inventory_counts OWNER TO postgres;

--
-- Name: inventory_counts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_counts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_counts_id_seq OWNER TO postgres;

--
-- Name: inventory_counts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_counts_id_seq OWNED BY public.inventory_counts.id;


--
-- Name: inventory_ledger; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_ledger (
    id bigint NOT NULL,
    item_id bigint NOT NULL,
    location_id bigint NOT NULL,
    movement_id bigint NOT NULL,
    quantity numeric(18,2) NOT NULL,
    unit_cost numeric(18,2) DEFAULT 0 NOT NULL,
    total_cost numeric(18,2) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.inventory_ledger OWNER TO postgres;

--
-- Name: inventory_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_ledger_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_ledger_id_seq OWNER TO postgres;

--
-- Name: inventory_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_ledger_id_seq OWNED BY public.inventory_ledger.id;


--
-- Name: issues; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.issues (
    id integer NOT NULL,
    user_id integer,
    message text NOT NULL,
    status character varying(20) DEFAULT 'OPEN'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.issues OWNER TO postgres;

--
-- Name: issues_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.issues_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.issues_id_seq OWNER TO postgres;

--
-- Name: issues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.issues_id_seq OWNED BY public.issues.id;


--
-- Name: items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.items (
    id bigint NOT NULL,
    category_id bigint,
    supplier_id bigint,
    name character varying(180) NOT NULL,
    description text,
    unit character varying(50) NOT NULL,
    reorder_level numeric(18,2) DEFAULT 0 NOT NULL,
    image_path text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.items OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.items_id_seq OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.items_id_seq OWNED BY public.items.id;


--
-- Name: locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.locations (
    id bigint NOT NULL,
    name character varying(150) NOT NULL,
    code character varying(50),
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.locations OWNER TO postgres;

--
-- Name: locations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.locations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.locations_id_seq OWNER TO postgres;

--
-- Name: locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;


--
-- Name: maintenance_items_used; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.maintenance_items_used (
    id bigint NOT NULL,
    maintenance_id bigint NOT NULL,
    movement_id bigint,
    item_id bigint NOT NULL,
    quantity numeric(18,2) NOT NULL,
    unit_cost numeric(18,2) DEFAULT 0 NOT NULL,
    CONSTRAINT maintenance_items_used_quantity_check CHECK ((quantity > (0)::numeric))
);


ALTER TABLE public.maintenance_items_used OWNER TO postgres;

--
-- Name: maintenance_items_used_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.maintenance_items_used_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.maintenance_items_used_id_seq OWNER TO postgres;

--
-- Name: maintenance_items_used_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.maintenance_items_used_id_seq OWNED BY public.maintenance_items_used.id;


--
-- Name: maintenance_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.maintenance_logs (
    id bigint NOT NULL,
    asset_id bigint NOT NULL,
    location_id bigint,
    description text NOT NULL,
    performed_by bigint NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.maintenance_logs OWNER TO postgres;

--
-- Name: maintenance_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.maintenance_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.maintenance_logs_id_seq OWNER TO postgres;

--
-- Name: maintenance_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.maintenance_logs_id_seq OWNED BY public.maintenance_logs.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id bigint NOT NULL,
    sender_id bigint NOT NULL,
    receiver_id bigint NOT NULL,
    subject character varying(200),
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.messages_id_seq OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: movement_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.movement_logs (
    id bigint NOT NULL,
    movement_id bigint NOT NULL,
    action character varying(50) NOT NULL,
    old_value jsonb,
    new_value jsonb,
    changed_by bigint,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.movement_logs OWNER TO postgres;

--
-- Name: movement_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.movement_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.movement_logs_id_seq OWNER TO postgres;

--
-- Name: movement_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.movement_logs_id_seq OWNED BY public.movement_logs.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    type character varying(50) NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: recipients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recipients (
    id bigint NOT NULL,
    name character varying(150) NOT NULL,
    department character varying(150),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.recipients OWNER TO postgres;

--
-- Name: recipients_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.recipients_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recipients_id_seq OWNER TO postgres;

--
-- Name: recipients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.recipients_id_seq OWNED BY public.recipients.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id bigint NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_movements (
    id bigint NOT NULL,
    item_id bigint NOT NULL,
    location_id bigint NOT NULL,
    section_id bigint,
    movement_type character varying(30) NOT NULL,
    quantity numeric(18,2) NOT NULL,
    unit_cost numeric(18,2) DEFAULT 0 NOT NULL,
    reference character varying(120),
    source_location_id bigint,
    destination_location_id bigint,
    asset_id bigint,
    recipient_id bigint,
    supplier_id bigint,
    request_id bigint,
    performed_by bigint NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_movements_movement_type_check CHECK (((movement_type)::text = ANY ((ARRAY['IN'::character varying, 'OUT'::character varying, 'TRANSFER'::character varying, 'MAINTENANCE'::character varying, 'ADJUSTMENT'::character varying, 'ASSET_ISSUE'::character varying])::text[]))),
    CONSTRAINT stock_movements_quantity_check CHECK ((quantity > (0)::numeric))
);


ALTER TABLE public.stock_movements OWNER TO postgres;

--
-- Name: stock_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_movements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_movements_id_seq OWNER TO postgres;

--
-- Name: stock_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_movements_id_seq OWNED BY public.stock_movements.id;


--
-- Name: stock_request_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_request_items (
    id bigint NOT NULL,
    request_id bigint NOT NULL,
    item_id bigint NOT NULL,
    quantity numeric(18,2) NOT NULL,
    unit_cost numeric(18,2) DEFAULT 0 NOT NULL,
    CONSTRAINT stock_request_items_quantity_check CHECK ((quantity > (0)::numeric))
);


ALTER TABLE public.stock_request_items OWNER TO postgres;

--
-- Name: stock_request_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_request_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_request_items_id_seq OWNER TO postgres;

--
-- Name: stock_request_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_request_items_id_seq OWNED BY public.stock_request_items.id;


--
-- Name: stock_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_requests (
    id bigint NOT NULL,
    request_number character varying(80) NOT NULL,
    requester_id bigint NOT NULL,
    location_id bigint NOT NULL,
    destination_location_id bigint,
    status character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
    notes text,
    approved_by bigint,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    source_location_id bigint,
    CONSTRAINT stock_requests_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'FULFILLED'::character varying])::text[])))
);


ALTER TABLE public.stock_requests OWNER TO postgres;

--
-- Name: stock_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_requests_id_seq OWNER TO postgres;

--
-- Name: stock_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_requests_id_seq OWNED BY public.stock_requests.id;


--
-- Name: store_sections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.store_sections (
    id bigint NOT NULL,
    location_id bigint NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.store_sections OWNER TO postgres;

--
-- Name: store_sections_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.store_sections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.store_sections_id_seq OWNER TO postgres;

--
-- Name: store_sections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.store_sections_id_seq OWNED BY public.store_sections.id;


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suppliers (
    id bigint NOT NULL,
    name character varying(150) NOT NULL,
    contact_name character varying(150),
    phone character varying(50),
    email character varying(255),
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.suppliers OWNER TO postgres;

--
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.suppliers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.suppliers_id_seq OWNER TO postgres;

--
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- Name: units; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.units (
    id bigint NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.units OWNER TO postgres;

--
-- Name: units_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.units_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.units_id_seq OWNER TO postgres;

--
-- Name: units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.units_id_seq OWNED BY public.units.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    role_id bigint NOT NULL,
    location_id bigint,
    full_name character varying(150) NOT NULL,
    email character varying(255) NOT NULL,
    password text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: alerts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts ALTER COLUMN id SET DEFAULT nextval('public.alerts_id_seq'::regclass);


--
-- Name: assets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets ALTER COLUMN id SET DEFAULT nextval('public.assets_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: inventory_count_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_count_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_count_items_id_seq'::regclass);


--
-- Name: inventory_counts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_counts ALTER COLUMN id SET DEFAULT nextval('public.inventory_counts_id_seq'::regclass);


--
-- Name: inventory_ledger id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_ledger ALTER COLUMN id SET DEFAULT nextval('public.inventory_ledger_id_seq'::regclass);


--
-- Name: issues id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.issues ALTER COLUMN id SET DEFAULT nextval('public.issues_id_seq'::regclass);


--
-- Name: items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items ALTER COLUMN id SET DEFAULT nextval('public.items_id_seq'::regclass);


--
-- Name: locations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);


--
-- Name: maintenance_items_used id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_items_used ALTER COLUMN id SET DEFAULT nextval('public.maintenance_items_used_id_seq'::regclass);


--
-- Name: maintenance_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_logs ALTER COLUMN id SET DEFAULT nextval('public.maintenance_logs_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: movement_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movement_logs ALTER COLUMN id SET DEFAULT nextval('public.movement_logs_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: recipients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipients ALTER COLUMN id SET DEFAULT nextval('public.recipients_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: stock_movements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements ALTER COLUMN id SET DEFAULT nextval('public.stock_movements_id_seq'::regclass);


--
-- Name: stock_request_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_request_items ALTER COLUMN id SET DEFAULT nextval('public.stock_request_items_id_seq'::regclass);


--
-- Name: stock_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_requests ALTER COLUMN id SET DEFAULT nextval('public.stock_requests_id_seq'::regclass);


--
-- Name: store_sections id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_sections ALTER COLUMN id SET DEFAULT nextval('public.store_sections_id_seq'::regclass);


--
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- Name: units id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units ALTER COLUMN id SET DEFAULT nextval('public.units_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: alerts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alerts (id, user_id, location_id, alert_type, title, message, is_read, created_at) FROM stdin;
\.


--
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.assets (id, location_id, asset_code, name, description, created_at) FROM stdin;
1	1	MACHINE 10 MAIN	FOAMING MAC. ANNEX	\N	2026-03-20 19:38:23.764108
2	2	Machinery-Air Compressor (Annex) 1-0001	Factory-General-Machinery-Air Compressor (Annex) 1-0001	\N	2026-03-24 09:19:08.175053
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, action, entity_type, entity_id, details, created_at) FROM stdin;
1	1	LOCATION_CREATED	locations	2	{"code": null, "name": "Annex", "location_id": "2"}	2026-03-20 19:26:28.967749
2	2	UNIT_CREATED	units	7	{"name": "pairs"}	2026-03-20 19:33:24.681623
3	2	RECIPIENT_CREATED	recipients	2	{"name": "Kojo", "department": "Mattress"}	2026-03-20 19:34:30.086697
4	2	CATEGORY_CREATED	categories	1	{"name": "PLUMPING ACCESSORIES "}	2026-03-20 19:35:59.133394
5	2	CATEGORY_CREATED	categories	2	{"name": "FOAMING MACHINE PART AND ACCESSORIES "}	2026-03-20 19:37:25.947515
6	2	ASSET_CREATED	assets	1	{"name": "FOAMING MAC. ANNEX", "asset_code": "MACHINE 10 MAIN", "location_id": "1"}	2026-03-20 19:38:23.798505
7	2	SUPPLIER_CREATED	suppliers	1	{"name": "SAMSARO"}	2026-03-20 19:38:37.260547
8	2	SUPPLIER_CREATED	suppliers	2	{"name": "CITY PAINT"}	2026-03-20 19:38:47.242443
9	2	RECIPIENT_CREATED	recipients	3	{"name": "EMMA", "department": null}	2026-03-20 19:39:01.504753
10	2	RECIPIENT_DELETED	recipients	3	{"name": "EMMA", "department": null}	2026-03-20 19:39:10.754726
11	2	RECIPIENT_CREATED	recipients	4	{"name": "EMMA", "department": "JOINERY"}	2026-03-20 19:40:03.729008
12	2	ITEM_CREATED	items	1	{"name": "Trying 1", "unit": "Piece", "category_id": "2"}	2026-03-20 19:41:11.754259
13	2	SECTION_CREATED	store_sections	1	{"name": "MAIN STORE ", "location_id": "1"}	2026-03-20 19:41:56.290451
14	2	MOVEMENT_IN	stock_movements	1	{"item_id": "1", "quantity": 10, "reference": "trying", "request_id": null, "location_id": 1, "delta_quantity": 10}	2026-03-20 19:42:37.122493
15	2	REQUEST_CREATED	stock_requests	1	{"items": 1, "location_id": "1"}	2026-03-20 19:43:12.719889
16	1	SECTION_CREATED	store_sections	2	{"name": "Annex ", "location_id": "2"}	2026-03-20 20:01:55.09023
17	3	REQUEST_CREATED	stock_requests	2	{"items": 1, "location_id": "1"}	2026-03-20 20:04:22.573016
18	1	MOVEMENT_OUT	stock_movements	2	{"item_id": "1", "quantity": 1, "reference": "REQ-2", "request_id": "2", "location_id": "1", "delta_quantity": -1}	2026-03-20 20:11:57.316853
19	1	MOVEMENT_IN	stock_movements	3	{"item_id": "1", "quantity": 1, "reference": "REQ-2", "request_id": "2", "location_id": "2", "delta_quantity": 1}	2026-03-20 20:11:57.316853
20	1	REQUEST_REJECTED	stock_requests	1	{"reason": "Rejected from dashboard"}	2026-03-20 20:12:01.179544
21	1	USER_CREATED	users	4	{"email": "debug.user@inventory.local", "role_name": "Admin", "location_id": null}	2026-03-20 20:26:54.423243
22	1	USER_CREATED	users	5	{"email": "http.user@inventory.local", "role_name": "SuperAdmin", "location_id": null}	2026-03-20 20:27:57.685261
23	1	USER_CREATED	users	6	{"email": "nanakwadjwo.prince@gmail.com", "role_name": "Admin", "location_id": 2}	2026-03-20 20:40:04.467975
24	6	REQUEST_CREATED	stock_requests	3	{"items": 1, "location_id": "2"}	2026-03-20 20:41:13.032416
25	6	MOVEMENT_OUT	stock_movements	4	{"item_id": "1", "quantity": 1, "reference": "REQ-3", "request_id": "3", "location_id": "2", "delta_quantity": -1}	2026-03-20 20:41:15.798164
26	6	MOVEMENT_IN	stock_movements	5	{"item_id": "1", "quantity": 1, "reference": "REQ-3", "request_id": "3", "location_id": "2", "delta_quantity": 1}	2026-03-20 20:41:15.798164
27	1	REQUEST_CREATED	stock_requests	4	{"items": 1, "source_location_id": 1, "destination_location_id": 2}	2026-03-20 21:20:43.340272
28	2	REQUEST_REJECTED	stock_requests	4	{"reason": "Verification cleanup"}	2026-03-20 21:21:30.288085
29	1	ITEM_CREATED	items	2	{"name": "Demo Transfer Stock", "unit": "PCS", "category_id": null}	2026-03-20 22:04:29.610169
30	1	MOVEMENT_IN	stock_movements	7	{"item_id": 2, "quantity": 25, "reference": "SEED-MAIN-STOCK", "request_id": null, "location_id": 1, "delta_quantity": 25}	2026-03-20 22:05:46.256618
31	1	MOVEMENT_IN	stock_movements	8	{"item_id": 2, "quantity": 3, "reference": "SEED-ANNEX-STOCK", "request_id": null, "location_id": 2, "delta_quantity": 3}	2026-03-20 22:05:46.434284
32	6	REQUEST_CREATED	stock_requests	5	{"items": 1, "source_location_id": 1, "destination_location_id": 2}	2026-03-20 22:17:02.762904
33	2	MOVEMENT_OUT	stock_movements	9	{"item_id": "2", "quantity": 1, "reference": "REQ-5", "request_id": "5", "location_id": 1, "delta_quantity": -1}	2026-03-20 22:19:15.796752
34	2	MOVEMENT_IN	stock_movements	10	{"item_id": "2", "quantity": 1, "reference": "REQ-5", "request_id": "5", "location_id": 2, "delta_quantity": 1}	2026-03-20 22:19:15.796752
35	2	REQUEST_APPROVED	stock_requests	5	{"items": 1, "reference": "REQ-5", "source_location_id": 1, "destination_location_id": 2}	2026-03-20 22:19:15.796752
36	1	MOVEMENT_IN	stock_movements	11	{"item_id": 2, "quantity": 1, "reference": "SEED-MAIN-STOCK", "request_id": null, "location_id": 1, "delta_quantity": 1}	2026-03-20 22:27:27.641976
37	10	REQUEST_CREATED	stock_requests	6	{"items": 1, "source_location_id": 1, "destination_location_id": 2}	2026-03-20 22:28:19.545057
38	2	MOVEMENT_OUT	stock_movements	12	{"item_id": "2", "quantity": 2, "reference": "REQ-1774045699537-461", "request_id": "6", "location_id": 1, "delta_quantity": -2}	2026-03-20 22:28:19.592652
39	2	MOVEMENT_IN	stock_movements	13	{"item_id": "2", "quantity": 2, "reference": "REQ-1774045699537-461", "request_id": "6", "location_id": 2, "delta_quantity": 2}	2026-03-20 22:28:19.592652
40	2	REQUEST_APPROVED	stock_requests	6	{"items": 1, "reference": "REQ-1774045699537-461", "source_location_id": 1, "destination_location_id": 2}	2026-03-20 22:28:19.592652
41	1	MOVEMENT_IN	stock_movements	14	{"item_id": 2, "quantity": 2, "reference": "SEED-MAIN-STOCK", "request_id": null, "location_id": 1, "delta_quantity": 2}	2026-03-20 22:31:13.586337
42	6	ITEM_UPDATED	items	1	{"name": "Trying 1", "unit": "Piece", "category_id": null}	2026-03-20 22:54:00.769445
43	6	ITEM_UPDATED	items	1	{"name": "Trying 1", "unit": "Piece", "category_id": null}	2026-03-20 22:54:11.09517
44	6	REQUEST_CREATED	stock_requests	7	{"items": 1, "source_location_id": 1, "destination_location_id": 2}	2026-03-20 22:55:35.084744
45	2	MOVEMENT_OUT	stock_movements	15	{"item_id": "2", "quantity": 3, "reference": "REQ-7", "request_id": "7", "location_id": 1, "delta_quantity": -3}	2026-03-20 22:56:40.989534
46	2	MOVEMENT_IN	stock_movements	16	{"item_id": "2", "quantity": 3, "reference": "REQ-7", "request_id": "7", "location_id": 2, "delta_quantity": 3}	2026-03-20 22:56:40.989534
47	2	REQUEST_APPROVED	stock_requests	7	{"items": 1, "reference": "REQ-7", "source_location_id": 1, "destination_location_id": 2}	2026-03-20 22:56:40.989534
48	6	REQUEST_CREATED	stock_requests	8	{"items": 1, "source_location_id": 1, "destination_location_id": 2}	2026-03-20 23:14:15.737546
49	2	MOVEMENT_OUT	stock_movements	17	{"item_id": "2", "quantity": 1, "reference": "REQ-8", "request_id": "8", "location_id": 1, "delta_quantity": -1}	2026-03-20 23:20:32.705331
50	2	MOVEMENT_IN	stock_movements	18	{"item_id": "2", "quantity": 1, "reference": "REQ-8", "request_id": "8", "location_id": 2, "delta_quantity": 1}	2026-03-20 23:20:32.705331
51	2	REQUEST_APPROVED	stock_requests	8	{"items": 1, "reference": "REQ-8", "source_location_id": 1, "destination_location_id": 2}	2026-03-20 23:20:32.705331
52	1	ITEM_UPDATED	items	1	{"name": "Trying 1", "unit": "Piece", "category_id": null}	2026-03-21 00:59:28.06359
53	6	REQUEST_CREATED	stock_requests	9	{"items": 1, "source_location_id": 1, "destination_location_id": 2}	2026-03-22 09:13:48.123727
54	2	MOVEMENT_OUT	stock_movements	19	{"item_id": "2", "quantity": 4, "reference": "REQ-9", "request_id": "9", "location_id": 1, "delta_quantity": -4}	2026-03-22 09:14:37.322056
55	2	MOVEMENT_IN	stock_movements	20	{"item_id": "2", "quantity": 4, "reference": "REQ-9", "request_id": "9", "location_id": 2, "delta_quantity": 4}	2026-03-22 09:14:37.322056
56	2	REQUEST_APPROVED	stock_requests	9	{"items": 1, "reference": "REQ-9", "source_location_id": 1, "destination_location_id": 2}	2026-03-22 09:14:37.322056
57	2	REQUEST_CREATED	stock_requests	10	{"items": 1, "source_location_id": 2, "destination_location_id": 1}	2026-03-22 09:15:42.056627
58	6	MOVEMENT_OUT	stock_movements	21	{"item_id": "2", "quantity": 3, "reference": "REQ-10", "request_id": "10", "location_id": 2, "delta_quantity": -3}	2026-03-22 09:16:15.261183
59	6	MOVEMENT_IN	stock_movements	22	{"item_id": "2", "quantity": 3, "reference": "REQ-10", "request_id": "10", "location_id": 1, "delta_quantity": 3}	2026-03-22 09:16:15.261183
60	6	REQUEST_APPROVED	stock_requests	10	{"items": 1, "reference": "REQ-10", "source_location_id": 2, "destination_location_id": 1}	2026-03-22 09:16:15.261183
61	6	ITEM_CREATED	items	3	{"name": "Cargo", "unit": "Pieces ", "category_id": "2"}	2026-03-22 09:57:37.290262
62	2	MOVEMENT_IN	stock_movements	23	{"item_id": "3", "quantity": 100, "reference": "trying", "request_id": null, "location_id": 1, "delta_quantity": 100}	2026-03-22 09:58:47.016502
63	6	REQUEST_CREATED	stock_requests	11	{"items": 1, "source_location_id": 1, "destination_location_id": 2}	2026-03-22 10:03:02.105222
64	2	MOVEMENT_OUT	stock_movements	24	{"item_id": "3", "quantity": 100, "reference": "REQ-11", "request_id": "11", "location_id": 1, "delta_quantity": -100}	2026-03-22 10:05:54.969847
65	2	MOVEMENT_IN	stock_movements	25	{"item_id": "3", "quantity": 100, "reference": "REQ-11", "request_id": "11", "location_id": 2, "delta_quantity": 100}	2026-03-22 10:05:54.969847
66	2	REQUEST_APPROVED	stock_requests	11	{"items": 1, "reference": "REQ-11", "source_location_id": 1, "destination_location_id": 2}	2026-03-22 10:05:54.969847
67	3	REQUEST_CREATED	stock_requests	12	{"items": 1, "source_location_id": 2, "destination_location_id": 1}	2026-03-22 10:09:23.273359
68	6	MOVEMENT_OUT	stock_movements	26	{"item_id": "3", "quantity": 76, "reference": "REQ-12", "request_id": "12", "location_id": 2, "delta_quantity": -76}	2026-03-22 10:10:06.543366
69	6	MOVEMENT_IN	stock_movements	27	{"item_id": "3", "quantity": 76, "reference": "REQ-12", "request_id": "12", "location_id": 1, "delta_quantity": 76}	2026-03-22 10:10:06.543366
70	6	REQUEST_APPROVED	stock_requests	12	{"items": 1, "reference": "REQ-12", "source_location_id": 2, "destination_location_id": 1}	2026-03-22 10:10:06.543366
71	2	ITEM_UPDATED	items	3	{"name": "Cargo", "unit": "Pieces ", "category_id": null}	2026-03-22 10:27:26.766513
72	2	ITEM_UPDATED	items	2	{"name": "Demo Transfer Stock", "unit": "PCS", "category_id": null}	2026-03-22 10:27:43.148832
73	6	ITEM_UPDATED	items	3	{"name": "Cargo", "unit": "Pieces ", "category_id": null}	2026-03-24 08:28:24.282245
74	6	REQUEST_CREATED	stock_requests	13	{"items": 1, "source_location_id": 1, "destination_location_id": 2}	2026-03-24 08:37:30.843833
75	3	REQUEST_CREATED	stock_requests	14	{"items": 1, "source_location_id": 2, "destination_location_id": 1}	2026-03-24 08:47:44.602028
76	1	MOVEMENT_OUT	stock_movements	28	{"item_id": "3", "quantity": 4, "reference": "REQ-14", "request_id": "14", "location_id": 2, "delta_quantity": -4}	2026-03-24 08:48:18.434601
77	1	MOVEMENT_IN	stock_movements	29	{"item_id": "3", "quantity": 4, "reference": "REQ-14", "request_id": "14", "location_id": 1, "delta_quantity": 4}	2026-03-24 08:48:18.434601
78	1	REQUEST_APPROVED	stock_requests	14	{"items": 1, "reference": "REQ-14", "source_location_id": 2, "destination_location_id": 1}	2026-03-24 08:48:18.434601
79	1	LOCATION_CREATED	locations	3	{"code": "Kumasi", "name": "Latex Foam Kumasi", "location_id": "3"}	2026-03-24 08:54:55.032516
80	1	LOCATION_UPDATED	locations	2	{"code": "Annex ", "name": "Latex Foam Annex", "is_active": true, "location_id": "2"}	2026-03-24 08:55:42.209925
81	1	LOCATION_UPDATED	locations	1	{"code": "Main Office ", "name": "Latex Foam Main Office ", "is_active": true, "location_id": "1"}	2026-03-24 08:57:12.616223
82	1	LOCATION_CREATED	locations	4	{"code": "Auto Workshop Accra ", "name": "Latex Foam AutoWorkshop Accra ", "location_id": "4"}	2026-03-24 08:58:08.992321
83	1	SECTION_UPDATED	store_sections	1	{"name": "MAIN STORE ", "location_id": "1"}	2026-03-24 08:58:41.392946
85	1	SECTION_UPDATED	store_sections	2	{"name": "Latex Foam Annex ", "location_id": "2"}	2026-03-24 08:59:42.031202
96	1	RECIPIENT_UPDATED	recipients	4	{"name": "Emmanuel", "department": "Joinery"}	2026-03-24 09:05:19.931187
84	1	SECTION_CREATED	store_sections	3	{"name": "Latex Foam Auto WorkShop Accra", "location_id": "4"}	2026-03-24 08:59:22.736924
86	1	SECTION_UPDATED	store_sections	1	{"name": "Latex Foam Main Office  ", "location_id": "1"}	2026-03-24 09:00:07.115379
87	1	UNIT_UPDATED	units	1	{"name": "Piece"}	2026-03-24 09:00:49.842585
88	1	UNIT_UPDATED	units	4	{"name": "Meters"}	2026-03-24 09:01:03.438055
89	1	UNIT_UPDATED	units	5	{"name": "Boxes"}	2026-03-24 09:01:09.874084
90	1	UNIT_UPDATED	units	3	{"name": "Liters "}	2026-03-24 09:01:18.707818
91	1	UNIT_UPDATED	units	2	{"name": "kg "}	2026-03-24 09:01:31.368782
92	1	UNIT_UPDATED	units	6	{"name": "Rolls "}	2026-03-24 09:01:41.668554
93	1	USER_UPDATED	users	10	{"email": "micheal@latexfoam.com", "is_active": true, "role_name": "Staff", "location_id": 2}	2026-03-24 09:03:29.18155
94	1	USER_UPDATED	users	2	{"email": "admin@inventory.local", "is_active": true, "role_name": "Admin", "location_id": 1}	2026-03-24 09:04:28.588396
97	1	RECIPIENT_UPDATED	recipients	2	{"name": "Isaac Maintenance", "department": "Mattress Department"}	2026-03-24 09:06:09.059937
95	1	USER_UPDATED	users	1	{"email": "superadmin@inventory.local", "is_active": true, "role_name": "SuperAdmin", "location_id": null}	2026-03-24 09:04:42.987715
98	1	SUPPLIER_UPDATED	suppliers	2	{"name": "CITY PAINT"}	2026-03-24 09:17:19.447937
99	1	SUPPLIER_CREATED	suppliers	3	{"name": "Local Market"}	2026-03-24 09:17:35.665756
100	1	SUPPLIER_UPDATED	suppliers	1	{"name": "Samsaro"}	2026-03-24 09:17:51.763591
101	1	SUPPLIER_UPDATED	suppliers	2	{"name": "City Paint"}	2026-03-24 09:18:05.771029
102	1	ASSET_CREATED	assets	2	{"name": "Factory-General-Machinery-Air Compressor (Annex) 1-0001", "asset_code": "Machinery-Air Compressor (Annex) 1-0001", "location_id": "2"}	2026-03-24 09:19:08.208525
103	6	MOVEMENT_MAINTENANCE	stock_movements	30	{"item_id": 3, "quantity": 3, "reference": "trying", "request_id": null, "location_id": 2, "delta_quantity": -3}	2026-03-24 09:20:15.232968
104	6	ITEM_UPDATED	items	3	{"name": "Cargo", "unit": "Boxes", "category_id": "2"}	2026-03-24 09:24:05.928805
105	6	ITEM_UPDATED	items	2	{"name": "Demo Transfer Stock", "unit": "Boxes", "category_id": "2"}	2026-03-24 09:24:44.064124
106	6	ITEM_UPDATED	items	1	{"name": "Trying 1", "unit": "Piece", "category_id": "1"}	2026-03-24 09:25:05.143427
107	1	MOVEMENT_OUT	stock_movements	31	{"item_id": "3", "quantity": 6, "reference": "REQ-13", "request_id": "13", "location_id": 1, "delta_quantity": -6}	2026-03-25 09:21:47.051574
108	1	MOVEMENT_IN	stock_movements	32	{"item_id": "3", "quantity": 6, "reference": "REQ-13", "request_id": "13", "location_id": 2, "delta_quantity": 6}	2026-03-25 09:21:47.051574
109	1	REQUEST_APPROVED	stock_requests	13	{"items": 1, "reference": "REQ-13", "source_location_id": 1, "destination_location_id": 2}	2026-03-25 09:21:47.051574
110	6	ITEM_UPDATED	items	3	{"name": "Cargo", "unit": "Boxes", "category_id": null}	2026-03-25 14:32:22.491021
111	6	ITEM_UPDATED	items	3	{"name": "Cargo", "unit": "Boxes", "category_id": "1"}	2026-03-25 14:32:53.959991
112	1	UNIT_UPDATED	units	5	{"name": "Boxes"}	2026-03-26 11:30:37.108832
113	6	MOVEMENT_OUT	stock_movements	44	{"item_id": "3", "quantity": 9, "reference": null, "request_id": null, "location_id": 2, "delta_quantity": -9}	2026-03-27 00:15:33.975839
114	6	MOVEMENT_OUT	stock_movements	45	{"item_id": "2", "quantity": 9, "reference": null, "request_id": null, "location_id": 2, "delta_quantity": -9}	2026-03-27 00:17:04.30431
115	6	ITEM_UPDATED	items	2	{"name": "Demo Transfer Stock", "unit": "Boxes", "category_id": null}	2026-03-27 00:19:38.686246
116	6	MOVEMENT_OUT	stock_movements	46	{"item_id": "2", "quantity": 2, "reference": null, "request_id": null, "location_id": 2, "delta_quantity": -2}	2026-03-27 00:20:36.46735
117	6	MOVEMENT_IN	stock_movements	47	{"item_id": "2", "quantity": 50, "reference": null, "request_id": null, "location_id": 2, "delta_quantity": 50}	2026-03-27 00:24:16.97017
118	10	MOVEMENT_DELETED	stock_movements	47	{"old_value": {"id": "47", "item_id": "2", "asset_id": null, "quantity": "50.00", "reference": null, "unit_cost": "0.00", "can_modify": true, "created_at": "2026-03-27T00:24:00.000Z", "request_id": null, "section_id": "2", "location_id": "2", "supplier_id": "2", "performed_by": "6", "recipient_id": null, "movement_type": "STOCK_IN", "ledger_quantity": "50.00", "ledger_unit_cost": "0.00", "ledger_total_cost": "0.00", "source_location_id": null, "adjustment_direction": null, "destination_location_id": null, "maintenance_usage_count": "0"}}	2026-03-27 09:26:36.016767
119	10	MOVEMENT_IN	stock_movements	48	{"item_id": "3", "quantity": 3, "reference": null, "request_id": null, "location_id": 2, "delta_quantity": 3}	2026-03-27 09:27:23.542275
120	10	MOVEMENT_DELETED	stock_movements	48	{"old_value": {"id": "48", "item_id": "3", "asset_id": "2", "quantity": "3.00", "reference": null, "unit_cost": "0.00", "can_modify": true, "created_at": "2026-03-27T09:27:00.000Z", "request_id": null, "section_id": "2", "location_id": "2", "supplier_id": "2", "performed_by": "10", "recipient_id": null, "movement_type": "STOCK_IN", "ledger_quantity": "3.00", "ledger_unit_cost": "0.00", "ledger_total_cost": "0.00", "source_location_id": null, "adjustment_direction": null, "destination_location_id": null, "maintenance_usage_count": "0"}}	2026-03-27 09:27:42.439061
121	10	MOVEMENT_DELETED	stock_movements	46	{"old_value": {"id": "46", "item_id": "2", "asset_id": "2", "quantity": "2.00", "reference": null, "unit_cost": "10.00", "can_modify": true, "created_at": "2026-03-27T00:20:00.000Z", "request_id": null, "section_id": "2", "location_id": "2", "supplier_id": null, "performed_by": "6", "recipient_id": null, "movement_type": "STOCK_OUT", "ledger_quantity": "-2.00", "ledger_unit_cost": "10.00", "ledger_total_cost": "-20.00", "source_location_id": null, "adjustment_direction": null, "destination_location_id": null, "maintenance_usage_count": "0"}}	2026-03-27 09:27:45.583915
122	1	USER_UPDATED	users	10	{"email": "michael@latexfoam.com", "is_active": true, "role_name": "Staff", "location_id": 2}	2026-03-27 09:31:12.496194
123	1	USER_CREATED	users	23	{"email": "emma@latexfoam.com", "role_name": "Staff", "location_id": 3}	2026-03-27 09:33:52.039876
124	10	REQUEST_CREATED	stock_requests	15	{"items": 1, "source_location_id": 3, "destination_location_id": 2}	2026-03-27 09:41:05.505878
125	10	REQUEST_CREATED	stock_requests	16	{"items": 1, "source_location_id": 1, "destination_location_id": 2}	2026-03-27 09:42:54.481992
126	1	MOVEMENT_OUT	stock_movements	49	{"item_id": "3", "quantity": 1, "reference": "REQ-1774604574482-396", "request_id": "16", "location_id": 1, "delta_quantity": -1}	2026-03-27 09:43:10.706972
127	1	MOVEMENT_IN	stock_movements	50	{"item_id": "3", "quantity": 1, "reference": "REQ-1774604574482-396", "request_id": "16", "location_id": 2, "delta_quantity": 1}	2026-03-27 09:43:10.706972
128	1	REQUEST_APPROVED	stock_requests	16	{"items": 1, "reference": "REQ-1774604574482-396", "source_location_id": 1, "destination_location_id": 2}	2026-03-27 09:43:10.706972
129	1	REQUEST_REJECTED	stock_requests	15	{"reason": null}	2026-03-27 09:43:26.890258
130	10	MOVEMENT_IN	stock_movements	51	{"item_id": "3", "quantity": 100, "reference": "boss", "request_id": null, "location_id": 2, "delta_quantity": 100}	2026-03-27 09:47:16.144992
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, name, description, created_at) FROM stdin;
1	PLUMPING ACCESSORIES 	\N	2026-03-20 19:35:59.103701
2	FOAMING MACHINE PART AND ACCESSORIES 	\N	2026-03-20 19:37:25.941041
\.


--
-- Data for Name: inventory_balance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_balance (item_id, location_id, quantity, updated_at) FROM stdin;
1	1	9.00	2026-03-20 20:11:57.316853
1	2	1.00	2026-03-20 20:41:15.798164
2	1	20.00	2026-03-22 09:16:15.261183
2	2	2.00	2026-03-27 09:27:45.583915
3	1	73.00	2026-03-27 09:43:10.706972
3	2	115.00	2026-03-27 09:47:16.144992
\.


--
-- Data for Name: inventory_count_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_count_items (id, count_id, item_id, system_quantity, counted_quantity, variance_quantity) FROM stdin;
\.


--
-- Data for Name: inventory_counts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_counts (id, location_id, section_id, counted_by, status, count_date, notes, created_at) FROM stdin;
\.


--
-- Data for Name: inventory_ledger; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_ledger (id, item_id, location_id, movement_id, quantity, unit_cost, total_cost, created_at) FROM stdin;
1	1	1	1	10.00	2.00	20.00	2026-03-20 19:42:00
2	1	1	2	-1.00	2.00	-2.00	2026-03-20 20:11:57.316853
3	1	2	3	1.00	2.00	2.00	2026-03-20 20:11:57.316853
4	1	2	4	-1.00	2.00	-2.00	2026-03-20 20:41:15.798164
5	1	2	5	1.00	2.00	2.00	2026-03-20 20:41:15.798164
6	2	1	7	25.00	10.00	250.00	2026-03-20 22:05:46.256618
7	2	2	8	3.00	10.00	30.00	2026-03-20 22:05:46.434284
8	2	1	9	-1.00	10.00	-10.00	2026-03-20 22:19:15.796752
9	2	2	10	1.00	10.00	10.00	2026-03-20 22:19:15.796752
10	2	1	11	1.00	10.00	10.00	2026-03-20 22:27:27.641976
11	2	1	12	-2.00	10.00	-20.00	2026-03-20 22:28:19.592652
12	2	2	13	2.00	10.00	20.00	2026-03-20 22:28:19.592652
13	2	1	14	2.00	10.00	20.00	2026-03-20 22:31:13.586337
14	2	1	15	-3.00	10.00	-30.00	2026-03-20 22:56:40.989534
15	2	2	16	3.00	10.00	30.00	2026-03-20 22:56:40.989534
16	2	1	17	-1.00	10.00	-10.00	2026-03-20 23:20:32.705331
17	2	2	18	1.00	10.00	10.00	2026-03-20 23:20:32.705331
18	2	1	19	-4.00	10.00	-40.00	2026-03-22 09:14:37.322056
19	2	2	20	4.00	10.00	40.00	2026-03-22 09:14:37.322056
20	2	2	21	-3.00	10.00	-30.00	2026-03-22 09:16:15.261183
21	2	1	22	3.00	10.00	30.00	2026-03-22 09:16:15.261183
22	3	1	23	100.00	4.00	400.00	2026-03-22 09:58:00
23	3	1	24	-100.00	4.00	-400.00	2026-03-22 10:05:54.969847
24	3	2	25	100.00	4.00	400.00	2026-03-22 10:05:54.969847
25	3	2	26	-76.00	4.00	-304.00	2026-03-22 10:10:06.543366
26	3	1	27	76.00	4.00	304.00	2026-03-22 10:10:06.543366
27	3	2	28	-4.00	4.00	-16.00	2026-03-24 08:48:18.434601
28	3	1	29	4.00	4.00	16.00	2026-03-24 08:48:18.434601
29	3	2	30	-3.00	4.00	-12.00	2026-03-24 09:20:15.232968
30	3	1	31	-6.00	4.00	-24.00	2026-03-25 09:21:47.051574
31	3	2	32	6.00	4.00	24.00	2026-03-25 09:21:47.051574
43	3	2	44	-9.00	4.00	-36.00	2026-04-04 00:15:00
44	2	2	45	-9.00	10.00	-90.00	2026-03-27 00:17:00
48	3	1	49	-1.00	4.00	-4.00	2026-03-27 09:43:10.706972
49	3	2	50	1.00	4.00	4.00	2026-03-27 09:43:10.706972
50	3	2	51	100.00	0.00	0.00	2026-03-27 09:46:00
\.


--
-- Data for Name: issues; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.issues (id, user_id, message, status, created_at) FROM stdin;
\.


--
-- Data for Name: items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.items (id, category_id, supplier_id, name, description, unit, reorder_level, image_path, is_active, created_at, updated_at) FROM stdin;
1	1	3	Trying 1	Trying ITEM 	Piece	2.00	/uploads/items/1774344304893-609984072.jpeg	t	2026-03-20 19:41:11.741033	2026-03-24 09:25:05.134525
3	1	\N	Cargo	Trying	Boxes	1.00	/uploads/items/1774449173908-356922918.png	t	2026-03-22 09:57:37.256763	2026-03-25 14:32:53.952594
2	\N	\N	Demo Transfer Stock	Seeded demo stock item for request approval testing	Boxes	2.00	/uploads/items/1774344283809-23180884.jpeg	t	2026-03-20 22:04:29.461123	2026-03-27 00:19:38.670443
\.


--
-- Data for Name: locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.locations (id, name, code, address, is_active, created_at) FROM stdin;
3	Latex Foam Kumasi	Kumasi	\N	t	2026-03-24 08:54:55.020618
2	Latex Foam Annex	Annex 	\N	t	2026-03-20 19:26:28.952007
1	Latex Foam Main Office 	Main Office 	Test Location	t	2026-03-20 19:20:20.47731
4	Latex Foam AutoWorkshop Accra 	Auto Workshop Accra 	\N	t	2026-03-24 08:58:08.985402
\.


--
-- Data for Name: maintenance_items_used; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.maintenance_items_used (id, maintenance_id, movement_id, item_id, quantity, unit_cost) FROM stdin;
1	1	30	3	3.00	0.00
\.


--
-- Data for Name: maintenance_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.maintenance_logs (id, asset_id, location_id, description, performed_by, created_at) FROM stdin;
1	2	2	Trying	6	2026-03-24 09:20:15.232968
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.messages (id, sender_id, receiver_id, subject, message, is_read, created_at) FROM stdin;
4	1	2	Trying	1234	f	2026-03-26 22:22:52.158984
3	1	6	Trying	12344	t	2026-03-26 22:20:06.126021
2	1	6	Trying	12344	t	2026-03-26 22:20:03.873079
1	1	6	Trying	How are you doing	t	2026-03-26 22:10:58.000521
6	6	3	Formal Request	Here to request boots	t	2026-03-26 23:58:59.969611
7	3	6	Trying	1122455985	t	2026-03-26 23:59:51.066958
5	6	10	try	try	t	2026-03-26 23:56:08.955
8	10	1	Trying	try 2	t	2026-03-27 09:25:28.854758
9	1	10	Again	Trying	t	2026-03-27 09:36:45.3945
10	1	10	This is from prince	Got your test message 👍 Everything’s working fine on my end.	f	2026-03-27 09:39:10.797527
\.


--
-- Data for Name: movement_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.movement_logs (id, movement_id, action, old_value, new_value, changed_by, "timestamp") FROM stdin;
1	44	CREATED	\N	{"id": "44", "item_id": "3", "asset_id": null, "quantity": "9.00", "reference": null, "unit_cost": "4.00", "can_modify": true, "created_at": "2026-04-04T00:15:00.000Z", "request_id": null, "section_id": "2", "location_id": "2", "supplier_id": null, "performed_by": "6", "recipient_id": "4", "movement_type": "STOCK_OUT", "ledger_quantity": -9, "source_location_id": null, "adjustment_direction": null, "destination_location_id": null, "maintenance_usage_count": 0}	6	2026-03-27 00:15:33.975839
2	45	CREATED	\N	{"id": "45", "item_id": "2", "asset_id": null, "quantity": "9.00", "reference": null, "unit_cost": "10.00", "can_modify": true, "created_at": "2026-03-27T00:17:00.000Z", "request_id": null, "section_id": "2", "location_id": "2", "supplier_id": null, "performed_by": "6", "recipient_id": "2", "movement_type": "STOCK_OUT", "ledger_quantity": -9, "source_location_id": null, "adjustment_direction": null, "destination_location_id": null, "maintenance_usage_count": 0}	6	2026-03-27 00:17:04.30431
6	49	CREATED	\N	{"id": "49", "item_id": "3", "asset_id": null, "quantity": "1.00", "reference": "REQ-1774604574482-396", "unit_cost": "4.00", "can_modify": false, "created_at": "2026-03-27T09:43:10.706Z", "request_id": "16", "section_id": null, "location_id": "1", "supplier_id": null, "performed_by": "1", "recipient_id": null, "movement_type": "STOCK_OUT", "ledger_quantity": -1, "source_location_id": "1", "adjustment_direction": null, "destination_location_id": "2", "maintenance_usage_count": 0}	1	2026-03-27 09:43:10.706972
7	50	CREATED	\N	{"id": "50", "item_id": "3", "asset_id": null, "quantity": "1.00", "reference": "REQ-1774604574482-396", "unit_cost": "4.00", "can_modify": false, "created_at": "2026-03-27T09:43:10.706Z", "request_id": "16", "section_id": null, "location_id": "2", "supplier_id": null, "performed_by": "1", "recipient_id": null, "movement_type": "STOCK_IN", "ledger_quantity": 1, "source_location_id": "1", "adjustment_direction": null, "destination_location_id": "2", "maintenance_usage_count": 0}	1	2026-03-27 09:43:10.706972
8	51	CREATED	\N	{"id": "51", "item_id": "3", "asset_id": null, "quantity": "100.00", "reference": "boss", "unit_cost": "0.00", "can_modify": true, "created_at": "2026-03-27T09:46:00.000Z", "request_id": null, "section_id": "2", "location_id": "2", "supplier_id": "2", "performed_by": "10", "recipient_id": null, "movement_type": "STOCK_IN", "ledger_quantity": 100, "source_location_id": null, "adjustment_direction": null, "destination_location_id": null, "maintenance_usage_count": 0}	10	2026-03-27 09:47:16.144992
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, title, message, type, is_read, created_at) FROM stdin;
1	1	Trying	New message from Michael Dadzie	new_message	f	2026-03-27 09:25:28.91069
2	10	Again	New message from Test SuperAdmin	new_message	f	2026-03-27 09:36:45.412468
3	10	This is from prince	New message from Test SuperAdmin	new_message	f	2026-03-27 09:39:10.846429
4	1	Stock request created	Michael Dadzie created REQ-1774604465504-227	stock_request_created	f	2026-03-27 09:41:05.560466
5	2	Stock request created	Michael Dadzie created REQ-1774604574482-396	stock_request_created	f	2026-03-27 09:42:54.535814
6	1	Stock request created	Michael Dadzie created REQ-1774604574482-396	stock_request_created	f	2026-03-27 09:42:54.540764
7	10	Stock request approved	REQ-1774604574482-396 is now APPROVED	stock_request_approved	f	2026-03-27 09:43:10.807293
8	10	Stock request rejected	REQ-1774604465504-227 is now REJECTED	stock_request_rejected	f	2026-03-27 09:43:26.902415
\.


--
-- Data for Name: recipients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recipients (id, name, department, created_at) FROM stdin;
4	Emmanuel	Joinery	2026-03-20 19:40:03.720752
2	Isaac Maintenance	Mattress Department	2026-03-20 19:34:30.077053
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, name, description, created_at) FROM stdin;
1	Admin	Secondary access	2026-03-19 16:16:06.735203
2	Staff	Basic access	2026-03-19 16:16:06.735203
3	SuperAdmin	Full system access	2026-03-19 16:16:06.735203
\.


--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_movements (id, item_id, location_id, section_id, movement_type, quantity, unit_cost, reference, source_location_id, destination_location_id, asset_id, recipient_id, supplier_id, request_id, performed_by, created_at) FROM stdin;
1	1	1	1	IN	10.00	2.00	trying	\N	\N	1	\N	2	\N	2	2026-03-20 19:42:00
2	1	1	\N	OUT	1.00	2.00	REQ-2	1	2	\N	\N	\N	2	1	2026-03-20 20:11:57.316853
3	1	2	\N	IN	1.00	2.00	REQ-2	1	2	\N	\N	\N	2	1	2026-03-20 20:11:57.316853
4	1	2	\N	OUT	1.00	2.00	REQ-3	2	2	\N	\N	\N	3	6	2026-03-20 20:41:15.798164
5	1	2	\N	IN	1.00	2.00	REQ-3	2	2	\N	\N	\N	3	6	2026-03-20 20:41:15.798164
7	2	1	\N	IN	25.00	10.00	SEED-MAIN-STOCK	\N	\N	\N	\N	\N	\N	1	2026-03-20 22:05:46.256618
8	2	2	\N	IN	3.00	10.00	SEED-ANNEX-STOCK	\N	\N	\N	\N	\N	\N	1	2026-03-20 22:05:46.434284
9	2	1	\N	OUT	1.00	10.00	REQ-5	1	2	\N	\N	\N	5	2	2026-03-20 22:19:15.796752
10	2	2	\N	IN	1.00	10.00	REQ-5	1	2	\N	\N	\N	5	2	2026-03-20 22:19:15.796752
11	2	1	\N	IN	1.00	10.00	SEED-MAIN-STOCK	\N	\N	\N	\N	\N	\N	1	2026-03-20 22:27:27.641976
12	2	1	\N	OUT	2.00	10.00	REQ-1774045699537-461	1	2	\N	\N	\N	6	2	2026-03-20 22:28:19.592652
13	2	2	\N	IN	2.00	10.00	REQ-1774045699537-461	1	2	\N	\N	\N	6	2	2026-03-20 22:28:19.592652
14	2	1	\N	IN	2.00	10.00	SEED-MAIN-STOCK	\N	\N	\N	\N	\N	\N	1	2026-03-20 22:31:13.586337
15	2	1	\N	OUT	3.00	10.00	REQ-7	1	2	\N	\N	\N	7	2	2026-03-20 22:56:40.989534
16	2	2	\N	IN	3.00	10.00	REQ-7	1	2	\N	\N	\N	7	2	2026-03-20 22:56:40.989534
17	2	1	\N	OUT	1.00	10.00	REQ-8	1	2	\N	\N	\N	8	2	2026-03-20 23:20:32.705331
18	2	2	\N	IN	1.00	10.00	REQ-8	1	2	\N	\N	\N	8	2	2026-03-20 23:20:32.705331
19	2	1	\N	OUT	4.00	10.00	REQ-9	1	2	\N	\N	\N	9	2	2026-03-22 09:14:37.322056
20	2	2	\N	IN	4.00	10.00	REQ-9	1	2	\N	\N	\N	9	2	2026-03-22 09:14:37.322056
21	2	2	\N	OUT	3.00	10.00	REQ-10	2	1	\N	\N	\N	10	6	2026-03-22 09:16:15.261183
22	2	1	\N	IN	3.00	10.00	REQ-10	2	1	\N	\N	\N	10	6	2026-03-22 09:16:15.261183
23	3	1	1	IN	100.00	4.00	trying	\N	\N	1	\N	2	\N	2	2026-03-22 09:58:00
24	3	1	\N	OUT	100.00	4.00	REQ-11	1	2	\N	\N	\N	11	2	2026-03-22 10:05:54.969847
25	3	2	\N	IN	100.00	4.00	REQ-11	1	2	\N	\N	\N	11	2	2026-03-22 10:05:54.969847
26	3	2	\N	OUT	76.00	4.00	REQ-12	2	1	\N	\N	\N	12	6	2026-03-22 10:10:06.543366
27	3	1	\N	IN	76.00	4.00	REQ-12	2	1	\N	\N	\N	12	6	2026-03-22 10:10:06.543366
28	3	2	\N	OUT	4.00	4.00	REQ-14	2	1	\N	\N	\N	14	1	2026-03-24 08:48:18.434601
29	3	1	\N	IN	4.00	4.00	REQ-14	2	1	\N	\N	\N	14	1	2026-03-24 08:48:18.434601
30	3	2	\N	MAINTENANCE	3.00	4.00	trying	\N	\N	2	\N	\N	\N	6	2026-03-24 09:20:15.232968
31	3	1	\N	OUT	6.00	4.00	REQ-13	1	2	\N	\N	\N	13	1	2026-03-25 09:21:47.051574
32	3	2	\N	IN	6.00	4.00	REQ-13	1	2	\N	\N	\N	13	1	2026-03-25 09:21:47.051574
44	3	2	2	OUT	9.00	4.00	\N	\N	\N	\N	4	\N	\N	6	2026-04-04 00:15:00
45	2	2	2	OUT	9.00	10.00	\N	\N	\N	\N	2	\N	\N	6	2026-03-27 00:17:00
49	3	1	\N	OUT	1.00	4.00	REQ-1774604574482-396	1	2	\N	\N	\N	16	1	2026-03-27 09:43:10.706972
50	3	2	\N	IN	1.00	4.00	REQ-1774604574482-396	1	2	\N	\N	\N	16	1	2026-03-27 09:43:10.706972
51	3	2	2	IN	100.00	0.00	boss	\N	\N	\N	\N	2	\N	10	2026-03-27 09:46:00
\.


--
-- Data for Name: stock_request_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_request_items (id, request_id, item_id, quantity, unit_cost) FROM stdin;
1	1	1	2.00	0.00
2	2	1	1.00	0.00
3	3	1	1.00	0.00
4	4	1	1.00	0.00
5	5	2	1.00	0.00
6	6	2	2.00	0.00
7	7	2	3.00	0.00
8	8	2	1.00	0.00
9	9	2	4.00	0.00
10	10	2	3.00	0.00
11	11	3	100.00	0.00
12	12	3	76.00	0.00
13	13	3	6.00	0.00
14	14	3	4.00	0.00
15	15	2	1.00	0.00
16	16	3	1.00	0.00
\.


--
-- Data for Name: stock_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_requests (id, request_number, requester_id, location_id, destination_location_id, status, notes, approved_by, approved_at, created_at, source_location_id) FROM stdin;
1	REQ-1774035792719-923	2	1	1	REJECTED	T	\N	\N	2026-03-20 19:43:12.719889	1
3	REQ-1774039273032-339	6	2	2	APPROVED	trying	6	2026-03-20 20:41:15.798164	2026-03-20 20:41:13.032416	2
2	REQ-1774037062566-325	3	2	2	APPROVED	\N	1	2026-03-20 20:11:57.316853	2026-03-20 20:04:22.573016	1
4	REQ-1774041643335-463	1	2	\N	REJECTED	Flow verification request	\N	\N	2026-03-20 21:20:43.340272	1
5	REQ-1774045022763-290	6	2	\N	APPROVED	try	2	2026-03-20 22:19:15.796752	2026-03-20 22:17:02.762904	1
6	REQ-1774045699537-461	10	2	\N	APPROVED	Workflow smoke test	2	2026-03-20 22:28:19.592652	2026-03-20 22:28:19.545057	1
7	REQ-1774047335086-316	6	2	\N	APPROVED	12	2	2026-03-20 22:56:40.989534	2026-03-20 22:55:35.084744	1
8	REQ-1774048455734-110	6	2	\N	APPROVED	\N	2	2026-03-20 23:20:32.705331	2026-03-20 23:14:15.737546	1
9	REQ-1774170828123-321	6	2	\N	APPROVED	try	2	2026-03-22 09:14:37.322056	2026-03-22 09:13:48.123727	1
10	REQ-1774170942056-837	2	1	\N	APPROVED	try	6	2026-03-22 09:16:15.261183	2026-03-22 09:15:42.056627	2
11	REQ-1774173782103-380	6	2	\N	APPROVED	trying 	2	2026-03-22 10:05:54.969847	2026-03-22 10:03:02.105222	1
12	REQ-1774174163272-246	3	1	\N	APPROVED	dex	6	2026-03-22 10:10:06.543366	2026-03-22 10:09:23.273359	2
14	REQ-1774342064602-526	3	1	\N	APPROVED	tyr123	1	2026-03-24 08:48:18.434601	2026-03-24 08:47:44.602028	2
13	REQ-1774341450846-693	6	2	\N	APPROVED	1	1	2026-03-25 09:21:47.051574	2026-03-24 08:37:30.843833	1
16	REQ-1774604574482-396	10	2	\N	APPROVED	\N	1	2026-03-27 09:43:10.706972	2026-03-27 09:42:54.481992	1
15	REQ-1774604465504-227	10	2	\N	REJECTED	\N	\N	\N	2026-03-27 09:41:05.505878	3
\.


--
-- Data for Name: store_sections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.store_sections (id, location_id, name, description, created_at) FROM stdin;
3	4	Latex Foam Auto WorkShop Accra	\N	2026-03-24 08:59:22.726545
2	2	Latex Foam Annex 	\N	2026-03-20 20:01:55.052609
1	1	Latex Foam Main Office  	\N	2026-03-20 19:41:56.285533
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suppliers (id, name, contact_name, phone, email, notes, created_at) FROM stdin;
3	Local Market	\N	\N	\N	\N	2026-03-24 09:17:35.64416
1	Samsaro	\N	\N	\N	\N	2026-03-20 19:38:37.251042
2	City Paint	\N	\N	\N	\N	2026-03-20 19:38:47.23899
\.


--
-- Data for Name: units; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.units (id, name, description, created_at) FROM stdin;
7	pairs	\N	2026-03-20 19:33:24.653684
1	Piece	\N	2026-03-20 18:44:13.069526
4	Meters	\N	2026-03-20 18:44:13.069526
3	Liters 	\N	2026-03-20 18:44:13.069526
2	kg 	\N	2026-03-20 18:44:13.069526
6	Rolls 	\N	2026-03-20 18:44:13.069526
5	Boxes	\N	2026-03-20 18:44:13.069526
14	PCS	\N	2026-03-27 09:59:42.043734
15	KG	\N	2026-03-27 09:59:42.043734
16	LITERS	\N	2026-03-27 09:59:42.043734
17	METERS	\N	2026-03-27 09:59:42.043734
18	BOXES	\N	2026-03-27 09:59:42.043734
19	ROLLS	\N	2026-03-27 09:59:42.043734
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, role_id, location_id, full_name, email, password, is_active, created_at) FROM stdin;
6	1	2	Prince Ntow	nanakwadjwo.prince@gmail.com	$2a$10$BGnVabwoRSTBrPMugerLoePv.L.IKXGIZZm8k7kUWMfvLask.bYBu	t	2026-03-20 20:40:04.440425
3	2	1	Test Staff	staff@inventory.local	$2a$10$iSogTgLDEPGYncEPzH3fm.6pycIipYU/RzIuWRVLHAMvjFOjP9qXC	t	2026-03-20 19:20:20.47731
2	1	1	Test Admin	admin@inventory.local	$2a$10$.02lnAeRgE7eChBTMgTfauSC47q3KS6rLs4CbfqiWfUsy01m6SLIK	t	2026-03-20 19:20:20.47731
1	3	\N	Test SuperAdmin	superadmin@inventory.local	$2a$10$RvZqeVPwx6tSWbHwS45qfuC0ERfk2B6aYcRTcEFKmikSdx5GgnDny	t	2026-03-20 19:20:20.47731
10	2	2	Michael Dadzie	michael@latexfoam.com	$2a$10$89/gjG1kHljdI2yma/IEROltQ6L6V1MMw4SYYyqDoFtYll7ynhXGi	t	2026-03-20 22:04:29.444584
23	2	3	Emmanuel Ofori	emma@latexfoam.com	$2a$10$de4TeGfWF4uXFZbZemLaw.2bSVHvnY9hDhmYtDYWnI1lGwmBEKGhi	t	2026-03-27 09:33:52.02562
\.


--
-- Name: alerts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.alerts_id_seq', 1, false);


--
-- Name: assets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.assets_id_seq', 2, true);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 130, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categories_id_seq', 2, true);


--
-- Name: inventory_count_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_count_items_id_seq', 1, false);


--
-- Name: inventory_counts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_counts_id_seq', 1, false);


--
-- Name: inventory_ledger_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_ledger_id_seq', 50, true);


--
-- Name: issues_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.issues_id_seq', 1, false);


--
-- Name: items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.items_id_seq', 3, true);


--
-- Name: locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.locations_id_seq', 6, true);


--
-- Name: maintenance_items_used_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.maintenance_items_used_id_seq', 1, true);


--
-- Name: maintenance_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.maintenance_logs_id_seq', 1, true);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.messages_id_seq', 10, true);


--
-- Name: movement_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.movement_logs_id_seq', 8, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 8, true);


--
-- Name: recipients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.recipients_id_seq', 4, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.roles_id_seq', 6, true);


--
-- Name: stock_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_movements_id_seq', 51, true);


--
-- Name: stock_request_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_request_items_id_seq', 16, true);


--
-- Name: stock_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_requests_id_seq', 16, true);


--
-- Name: store_sections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.store_sections_id_seq', 3, true);


--
-- Name: suppliers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.suppliers_id_seq', 3, true);


--
-- Name: units_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.units_id_seq', 25, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 23, true);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: assets assets_asset_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_asset_code_key UNIQUE (asset_code);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: inventory_balance inventory_balance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_balance
    ADD CONSTRAINT inventory_balance_pkey PRIMARY KEY (item_id, location_id);


--
-- Name: inventory_count_items inventory_count_items_count_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_count_items
    ADD CONSTRAINT inventory_count_items_count_id_item_id_key UNIQUE (count_id, item_id);


--
-- Name: inventory_count_items inventory_count_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_count_items
    ADD CONSTRAINT inventory_count_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_counts inventory_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_pkey PRIMARY KEY (id);


--
-- Name: inventory_ledger inventory_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_ledger
    ADD CONSTRAINT inventory_ledger_pkey PRIMARY KEY (id);


--
-- Name: issues issues_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issues_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: locations locations_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_code_key UNIQUE (code);


--
-- Name: locations locations_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_name_key UNIQUE (name);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: maintenance_items_used maintenance_items_used_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_items_used
    ADD CONSTRAINT maintenance_items_used_pkey PRIMARY KEY (id);


--
-- Name: maintenance_logs maintenance_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_logs
    ADD CONSTRAINT maintenance_logs_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: movement_logs movement_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movement_logs
    ADD CONSTRAINT movement_logs_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: recipients recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipients
    ADD CONSTRAINT recipients_pkey PRIMARY KEY (id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stock_request_items stock_request_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_request_items
    ADD CONSTRAINT stock_request_items_pkey PRIMARY KEY (id);


--
-- Name: stock_request_items stock_request_items_request_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_request_items
    ADD CONSTRAINT stock_request_items_request_id_item_id_key UNIQUE (request_id, item_id);


--
-- Name: stock_requests stock_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_requests
    ADD CONSTRAINT stock_requests_pkey PRIMARY KEY (id);


--
-- Name: stock_requests stock_requests_request_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_requests
    ADD CONSTRAINT stock_requests_request_number_key UNIQUE (request_number);


--
-- Name: store_sections store_sections_location_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_sections
    ADD CONSTRAINT store_sections_location_id_name_key UNIQUE (location_id, name);


--
-- Name: store_sections store_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_sections
    ADD CONSTRAINT store_sections_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_name_key UNIQUE (name);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: units units_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_name_key UNIQUE (name);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_inventory_balance_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_balance_location ON public.inventory_balance USING btree (location_id);


--
-- Name: idx_inventory_ledger_item_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_ledger_item_location ON public.inventory_ledger USING btree (item_id, location_id);


--
-- Name: idx_maintenance_logs_asset; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_maintenance_logs_asset ON public.maintenance_logs USING btree (asset_id, created_at DESC);


--
-- Name: idx_movement_logs_movement_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_movement_logs_movement_timestamp ON public.movement_logs USING btree (movement_id, "timestamp" DESC);


--
-- Name: idx_notifications_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user_created ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_stock_movements_item_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_movements_item_date ON public.stock_movements USING btree (item_id, created_at DESC);


--
-- Name: idx_stock_movements_location_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_movements_location_date ON public.stock_movements USING btree (location_id, created_at DESC);


--
-- Name: idx_stock_requests_source_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_requests_source_location ON public.stock_requests USING btree (source_location_id);


--
-- Name: idx_stock_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_requests_status ON public.stock_requests USING btree (status);


--
-- Name: alerts alerts_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: alerts alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: assets assets_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: inventory_balance inventory_balance_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_balance
    ADD CONSTRAINT inventory_balance_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: inventory_balance inventory_balance_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_balance
    ADD CONSTRAINT inventory_balance_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: inventory_count_items inventory_count_items_count_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_count_items
    ADD CONSTRAINT inventory_count_items_count_id_fkey FOREIGN KEY (count_id) REFERENCES public.inventory_counts(id) ON DELETE CASCADE;


--
-- Name: inventory_count_items inventory_count_items_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_count_items
    ADD CONSTRAINT inventory_count_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: inventory_counts inventory_counts_counted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_counted_by_fkey FOREIGN KEY (counted_by) REFERENCES public.users(id);


--
-- Name: inventory_counts inventory_counts_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: inventory_counts inventory_counts_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_counts
    ADD CONSTRAINT inventory_counts_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.store_sections(id);


--
-- Name: inventory_ledger inventory_ledger_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_ledger
    ADD CONSTRAINT inventory_ledger_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: inventory_ledger inventory_ledger_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_ledger
    ADD CONSTRAINT inventory_ledger_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: inventory_ledger inventory_ledger_movement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_ledger
    ADD CONSTRAINT inventory_ledger_movement_id_fkey FOREIGN KEY (movement_id) REFERENCES public.stock_movements(id) ON DELETE CASCADE;


--
-- Name: issues issues_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issues_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: items items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: items items_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: maintenance_items_used maintenance_items_used_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_items_used
    ADD CONSTRAINT maintenance_items_used_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: maintenance_items_used maintenance_items_used_maintenance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_items_used
    ADD CONSTRAINT maintenance_items_used_maintenance_id_fkey FOREIGN KEY (maintenance_id) REFERENCES public.maintenance_logs(id) ON DELETE CASCADE;


--
-- Name: maintenance_items_used maintenance_items_used_movement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_items_used
    ADD CONSTRAINT maintenance_items_used_movement_id_fkey FOREIGN KEY (movement_id) REFERENCES public.stock_movements(id) ON DELETE SET NULL;


--
-- Name: maintenance_logs maintenance_logs_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_logs
    ADD CONSTRAINT maintenance_logs_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);


--
-- Name: maintenance_logs maintenance_logs_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_logs
    ADD CONSTRAINT maintenance_logs_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: maintenance_logs maintenance_logs_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_logs
    ADD CONSTRAINT maintenance_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: messages messages_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id);


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: movement_logs movement_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movement_logs
    ADD CONSTRAINT movement_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: movement_logs movement_logs_movement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movement_logs
    ADD CONSTRAINT movement_logs_movement_id_fkey FOREIGN KEY (movement_id) REFERENCES public.stock_movements(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);


--
-- Name: stock_movements stock_movements_destination_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_destination_location_id_fkey FOREIGN KEY (destination_location_id) REFERENCES public.locations(id);


--
-- Name: stock_movements stock_movements_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: stock_movements stock_movements_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: stock_movements stock_movements_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: stock_movements stock_movements_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.recipients(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.stock_requests(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.store_sections(id);


--
-- Name: stock_movements stock_movements_source_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_source_location_id_fkey FOREIGN KEY (source_location_id) REFERENCES public.locations(id);


--
-- Name: stock_movements stock_movements_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: stock_request_items stock_request_items_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_request_items
    ADD CONSTRAINT stock_request_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: stock_request_items stock_request_items_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_request_items
    ADD CONSTRAINT stock_request_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.stock_requests(id) ON DELETE CASCADE;


--
-- Name: stock_requests stock_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_requests
    ADD CONSTRAINT stock_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: stock_requests stock_requests_destination_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_requests
    ADD CONSTRAINT stock_requests_destination_location_id_fkey FOREIGN KEY (destination_location_id) REFERENCES public.locations(id);


--
-- Name: stock_requests stock_requests_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_requests
    ADD CONSTRAINT stock_requests_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: stock_requests stock_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_requests
    ADD CONSTRAINT stock_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id);


--
-- Name: stock_requests stock_requests_source_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_requests
    ADD CONSTRAINT stock_requests_source_location_id_fkey FOREIGN KEY (source_location_id) REFERENCES public.locations(id);


--
-- Name: store_sections store_sections_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_sections
    ADD CONSTRAINT store_sections_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: users users_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- PostgreSQL database dump complete
--

\unrestrict TvoXCbgQaY8YQDeAiX3hTyUEFu7a0GYPOhzW2y8I3VNgqO9WotYGMy3VkIYVUNC


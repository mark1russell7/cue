// Docker Compose Schema
//
// Defines the structure of docker-compose.yml files.
// Simplified schema focusing on patterns used in the mark ecosystem.

package docker

// Docker Compose file structure (v3.x compatible)
#DockerCompose: {
	// Version is optional in modern Docker Compose
	version?: string

	// Services definitions
	services: {
		[#ServiceName]: #Service
	}

	// Named volumes
	volumes?: {
		[#VolumeName]: #VolumeConfig | null
	}

	// Networks
	networks?: {
		[#NetworkName]: #NetworkConfig | null
	}
}

// Service name: lowercase alphanumeric with hyphens/underscores
#ServiceName: =~"^[a-z][a-z0-9_-]*$"
#VolumeName:  =~"^[a-z][a-z0-9_-]*$"
#NetworkName: =~"^[a-z][a-z0-9_-]*$"

// Service definition
#Service: {
	// Container image
	image: string

	// Container name
	container_name?: string

	// Build configuration
	build?: string | #BuildConfig

	// Port mappings
	ports?: [...#PortMapping]

	// Volume mounts
	volumes?: [...#VolumeMount]

	// Environment variables
	environment?: [...string] | {[string]: string}

	// Command override
	command?: string | [...string]

	// Entrypoint override
	entrypoint?: string | [...string]

	// Working directory
	working_dir?: string

	// Dependencies
	depends_on?: [...string] | {[string]: #DependsOnCondition}

	// Healthcheck
	healthcheck?: #Healthcheck

	// Restart policy
	restart?: "no" | "always" | "on-failure" | "unless-stopped"

	// Networks
	networks?: [...string] | {[string]: #ServiceNetworkConfig}

	// Labels
	labels?: [...string] | {[string]: string}

	// Logging
	logging?: #LoggingConfig

	// Deploy configuration (for swarm mode)
	deploy?: #DeployConfig

	// Allow additional fields
	...
}

// Build configuration
#BuildConfig: {
	context:    string
	dockerfile?: string
	args?: {[string]: string}
	target?: string
	...
}

// Port mapping: "host:container" or "container"
#PortMapping: string & =~"^[0-9${}:.-]+$"

// Volume mount: "source:target" or "source:target:mode"
#VolumeMount: string

// Depends on condition
#DependsOnCondition: {
	condition: "service_started" | "service_healthy" | "service_completed_successfully"
}

// Healthcheck configuration
#Healthcheck: {
	test:      string | [...string]
	interval?: string & =~"^[0-9]+[smh]$"
	timeout?:  string & =~"^[0-9]+[smh]$"
	retries?:  int & >=0
	start_period?: string & =~"^[0-9]+[smh]$"
	disable?: bool
}

// Volume configuration
#VolumeConfig: {
	driver?: string
	driver_opts?: {[string]: string}
	external?: bool
	labels?: {[string]: string}
	name?: string
}

// Network configuration
#NetworkConfig: {
	driver?: "bridge" | "host" | "overlay" | "none"
	driver_opts?: {[string]: string}
	external?: bool
	internal?: bool
	ipam?: #IpamConfig
	labels?: {[string]: string}
	name?: string
}

// Service network configuration
#ServiceNetworkConfig: {
	aliases?: [...string]
	ipv4_address?: string
	ipv6_address?: string
}

// IPAM configuration
#IpamConfig: {
	driver?: string
	config?: [...{
		subnet?: string
		gateway?: string
		...
	}]
}

// Logging configuration
#LoggingConfig: {
	driver?: string
	options?: {[string]: string}
}

// Deploy configuration
#DeployConfig: {
	mode?: "replicated" | "global"
	replicas?: int & >=0
	resources?: #ResourcesConfig
	restart_policy?: #RestartPolicyConfig
	placement?: #PlacementConfig
	...
}

// Resources configuration
#ResourcesConfig: {
	limits?: {
		cpus?: string
		memory?: string
	}
	reservations?: {
		cpus?: string
		memory?: string
	}
}

// Restart policy configuration
#RestartPolicyConfig: {
	condition?: "none" | "on-failure" | "any"
	delay?: string
	max_attempts?: int
	window?: string
}

// Placement configuration
#PlacementConfig: {
	constraints?: [...string]
	preferences?: [...{spread?: string}]
}

// Validation examples
_mongoExample: #DockerCompose & {
	services: {
		mongodb: {
			image:          "mongo:8.0"
			container_name: "mongo-db"
			ports: ["27017:27017"]
			volumes: [
				"mongodb_data:/data/db",
				"mongodb_config:/data/configdb",
			]
			environment: ["MONGO_INITDB_DATABASE=app"]
			healthcheck: {
				test:     "mongosh --eval \"db.adminCommand('ping')\""
				interval: "10s"
				timeout:  "5s"
				retries:  5
			}
			restart: "unless-stopped"
		}
	}
	volumes: {
		mongodb_data:   null
		mongodb_config: null
	}
}

_sqliteExample: #DockerCompose & {
	services: {
		"sqlite-web": {
			image:          "coleifer/sqlite-web"
			container_name: "sqlite-web"
			ports: ["8080:8080"]
			volumes: ["./data:/data:rw"]
			command: "sqlite_web -H 0.0.0.0 /data/cli.db"
			restart: "unless-stopped"
			healthcheck: {
				test:     ["CMD", "wget", "-q", "--spider", "http://localhost:8080/"]
				interval: "30s"
				timeout:  "10s"
				retries:  3
			}
		}
	}
}

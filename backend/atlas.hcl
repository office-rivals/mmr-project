data "external_schema" "gorm" {
  program = [
    "go",
    "run",
    "-mod=mod",
    "./loader",
  ]
}

variable "db_host" {
  type    = string
  default = "localhost"
}

variable "db_port" {
  type    = string
  default = "5432"
}

variable "db_user" {
  type    = string
  default = "postgres"
}

variable "db_password" {
  type    = string
  default = "this_is_a_hard_password1337"
}

variable "db_name" {
  type    = string
  default = "mmr_project"
}

env "gorm" {
  src = data.external_schema.gorm.url
  dev = "docker://postgres/15/dev?search_path=public"
  url = "postgres://${var.db_host}:${var.db_port}/${var.db_name}?user=${var.db_user}&password=${var.db_password}&sslmode=disable"
  migration {
    dir = "file://migrations"
  }
  format {
    migrate {
      diff = "{{ sql . \"  \" }}"
    }
  }
}
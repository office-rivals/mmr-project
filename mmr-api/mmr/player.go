package mmr

import "github.com/intinig/go-openskill/types"

type Player struct {
	Initials string
	Player   types.Rating
}

type PlayerV2 struct {
	Id int64
	Player   types.Rating
}

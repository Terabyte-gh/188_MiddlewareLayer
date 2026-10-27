import express from 'express'
import Joi from 'joi'
import pg from 'pg'

const app = express()
const port = 3000
const { Pool } = pg

const pool = new pool({
    user: 'postgres',
    host: 'localhost',
    database: 'mahasiswa',
    password: '',
    port: 5432
})

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

//MIDDLEWARE
app.use((req, res, next) => {
    const start = Date.now()

    res.on('finish', () => {
        const duration = Date.now() - start
        
        console.log({
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`
        })
    })
    next()
})

//RESPONE ENVELOPE
function successResponse(res, message, data, status = 200) {
    return res.status(status).json({
        success: 'true',
        message,
        data,
        error: null
    })
}

function errorResponse(res, message, status, details = null) {
    return res.status(status).json({
        success: false,
        message,
        data: null,
        error: details,
    })
}

//JOI VALIDATION
const biodataSchema = Joi.object({
    id: Joi.number().integer().positive(),
    nama: Joi.string().trim().min(2).max(100).required(),
    nim: Joi.string().trim().min(5).max(20).required(),
    kelas: Joi.string().trim().min(1).max(20).required(),
})

const idSchema = Joi.object({
    id: Joi.number().interger().positive().required(),
})

//Middleware validation body
function validateBody(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            convert: true,
            allowUnknown: false
        })

        if (error) {
            return errorResponse(
                res,
                'Validation error',
                400,
                error.details.map(item => ({
                    field: item.path.join('.'),
                    message: item.message
                }))
            )
        }
        req.body = value
        next()
    }
}

//middleware validation parameter
function validateParams(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.params, {
            abortEarly: false,
            convert: true,
            allowUnknown: false
        })

        if (error) {
            return errorResponse(
                res,
                'Parameter Tidak Valid',
                400,
                error.details.map(item => ({
                    field: item.path.join('.'),
                    message: item.message
                }))
            )
        }
        req.params = value
        next()
    }
}

//method get 
app.get('/', async (req, res) => {
    const result = await pool.query(
        'SELECT * FROM biodata ORDER BY id'
    )
    return successResponse(res, 'Data berhasil diambil', result.rows)
})

//method post
app.post(
    '/biodata',
    validateBody(biodataSchema),
    async (req, res) => {
        const { id, nama, nim, kelas } = req.body

        const result = await pool.query(
            'INSERT INTO biodata(id, nama, nim, kelas) VALUES($1, $2, $3, $4) RETURNING *',
            [id, nama, nim, kelas]
        )

        return successResponse(
            res, 
            'Data berhasil ditambahkan',
            result.rows[0],
            201
        )
    }
)

//method put
app.put(
    '/biodata/:id',
    validateParams(idSchema),
    validateBody(biodataSchema).fork(
        ['nama', 'nim', 'kelas'], field => field.required()
    ).fork(['id'], field => field.forbidden()),
    async (req, res) => {
        const { id } = req.params
        const { nama, nim, kelas } = req.body

        const result = await pool.query(
            'UPDATE biodata SET nama = $1, nim = $2, kelas = $3 WHERE id = $4 RETURNING *',
            [nama, nim, kelas, id]
        )

        if (result.rowCount === 0) {
            return errorResponse(
                res, 'Data tidak ditemukan', 404
            )
        }
        
        return successResponse(
            res,
            'Data berhasil diperbarui',
            result.rows[0]
        )
    }
)

//method delete
app.delete(
    '/biodata/:id',
    validateParams(idSchema),
    async (req, res) => {
        const { id } = req.params
        const { nama, nim, kelas } = req.body

        const result = await pool.query(
            'DELETE FROM biodata WHERE id = $1 RETURNING *',
            [id]
        )

        if (result.rowCount === 0) {
            return errorResponse(
                res, 'Data tidak ditemukan', 404
            )
        }
        
        return successResponse(
            res,
            'Data berhasil dihapus',
            result.rows[0]
        )
    }
)

//route not found
app.use((req, res) => {
    return errorResponse(
        res,
        'Endpoint tidak ditemukan', 404
    )
})

app.use((err, req, res, next) => {
    console.error(err)

    if (res.headersSent) {
        return next(err)
    }

    return errorResponse(
        res,
        'Terjadi kesalahan pada server', 500
    )
})

